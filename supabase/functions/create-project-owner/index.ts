// create-project-owner — Prism LM (or CEO) provisions a PROJECT_OWNER for a project.

import { handleCors } from '../_shared/cors.ts';
import { createUserClient, createServiceClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { isValidEmail } from '../_shared/password.ts';
import { sendEmailViaResend, renderStaffInviteEmail } from '../_shared/email.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(role, ['CEO', 'ADMIN', 'LINE_MANAGER'], 'Only Prism staff can create project owners');

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.fullName ?? '').trim();
    const projectId = String(body.projectId ?? '').trim();

    if (!projectId) throw new HttpError(400, 'projectId is required');
    if (!email || !isValidEmail(email)) throw new HttpError(400, 'Valid email is required');
    if (fullName.length < 2) throw new HttpError(400, 'Full name must be at least 2 characters');

    const admin = createServiceClient();

    const { data: project, error: projErr } = await admin
      .from('projects')
      .select('id, code, name, created_by')
      .eq('id', projectId)
      .single();
    if (projErr || !project) throw new HttpError(404, 'Project not found');

    if (role === 'LINE_MANAGER' && project.created_by !== user.id) {
      throw new HttpError(403, 'You can only assign an owner on your own projects');
    }

    let ownerId: string;
    let createdNew = false;

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, role, email')
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.role !== 'PROJECT_OWNER') {
        throw new HttpError(
          400,
          `A user with this email already exists as ${existingProfile.role}. Use a dedicated owner email.`,
        );
      }
      ownerId = existingProfile.id;
      await admin.from('profiles').update({ full_name: fullName }).eq('id', ownerId);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: 'PROJECT_OWNER' },
      });
      if (error) {
        const message = error.message.includes('already')
          ? 'A user with this email already exists'
          : error.message;
        throw new HttpError(400, message);
      }
      if (!data.user) throw new HttpError(500, 'User creation failed');
      ownerId = data.user.id;
      createdNew = true;

      await admin
        .from('profiles')
        .update({ role: 'PROJECT_OWNER', full_name: fullName, email })
        .eq('id', ownerId);
    }

    const { error: updErr } = await admin
      .from('projects')
      .update({ project_owner_id: ownerId })
      .eq('id', projectId);
    if (updErr) throw new HttpError(400, updErr.message);

    // Fresh first-signin code for every assignment (new or re-link).
    const { data: codeData, error: codeErr } = await admin.rpc('generate_staff_signin_code', {
      p_user_id: ownerId,
    });
    if (codeErr || !codeData) {
      throw new HttpError(500, `Could not generate sign-in code: ${codeErr?.message ?? 'unknown'}`);
    }
    const signinCode = String(codeData);

    await admin.from('notifications').insert({
      user_id: ownerId,
      type: 'PROJECT_APPROVED',
      title: 'You were assigned as project owner',
      body: `${project.code} · ${project.name}`,
      project_id: projectId,
      entity_id: projectId,
      href: `/(tabs)/projects/${projectId}`,
    });

    let emailSent = false;
    let emailError: string | null = null;
    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
    const signInUrl = appUrl
      ? `${appUrl}/first-signin?email=${encodeURIComponent(email)}&code=${encodeURIComponent(signinCode)}`
      : '';
    const roleLabel = `Project Owner · ${project.code}`;
    const { subject, html, text } = renderStaffInviteEmail({
      fullName,
      roleLabel,
      code: signinCode,
      signInUrl: signInUrl || `${appUrl || 'https://app.prism.capital'}/first-signin`,
    });
    try {
      await sendEmailViaResend({ to: email, subject, html, text });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
      console.error('create-project-owner email failed', emailError);
    }

    return jsonResponse({
      userId: ownerId,
      email,
      fullName,
      role: 'PROJECT_OWNER',
      projectId,
      createdNew,
      emailSent,
      emailError,
      signinCode: emailSent ? null : signinCode,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
