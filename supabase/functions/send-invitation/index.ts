import { handleCors } from '../_shared/cors.ts';
import { createUserClient, createServiceClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { isValidEmail } from '../_shared/password.ts';
import {
  sendEmailViaResend,
  renderInviteEmail,
  renderExistingInvestorInviteEmail,
} from '../_shared/email.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(
      role,
      ['LINE_MANAGER', 'ADMIN'],
      'Only line managers and admins can send invitations',
    );

    const body = await req.json();
    const projectId = String(body.projectId ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const rawMinUnits = body.minUnits;
    const minUnits =
      rawMinUnits === undefined || rawMinUnits === null || rawMinUnits === ''
        ? null
        : Number(rawMinUnits);
    const roundId = body.roundId ? String(body.roundId) : null;

    if (!projectId) throw new HttpError(400, 'projectId is required');
    if (!email || !isValidEmail(email)) {
      throw new HttpError(400, 'Valid email is required');
    }
    if (
      minUnits !== null &&
      (!Number.isInteger(minUnits) || minUnits <= 0)
    ) {
      throw new HttpError(400, 'minUnits must be a positive whole number');
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, approval_status, created_by, profiles:created_by(full_name)')
      .eq('id', projectId)
      .single();

    if (projectError || !project) throw new HttpError(404, 'Project not found');
    if (project.approval_status !== 'APPROVED') {
      throw new HttpError(400, 'Project must be approved before inviting investors');
    }
    if (role === 'LINE_MANAGER' && project.created_by !== user.id) {
      throw new HttpError(403, 'Line managers can only invite on their own projects');
    }

    if (roundId) {
      const { data: round, error: roundErr } = await supabase
        .from('funding_rounds')
        .select('id, project_id, status')
        .eq('id', roundId)
        .maybeSingle();
      if (roundErr || !round) throw new HttpError(400, 'Funding round not found');
      if (round.project_id !== projectId) {
        throw new HttpError(400, 'Funding round does not belong to this project');
      }
      if (round.status !== 'APPROVED') {
        throw new HttpError(400, 'Funding round must be approved before inviting');
      }
    }

    const admin = createServiceClient();

    // 1. Find or create investor profile (no Supabase email — we send our own).
    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();
    if (profileError) throw new HttpError(400, profileError.message);

    let investorId: string;
    let isNewInvestor = false;

    if (existingProfile) {
      if (existingProfile.role !== 'INVESTOR') {
        throw new HttpError(400, 'This email belongs to a non-investor account');
      }
      investorId = existingProfile.id;
    } else {
      // Create auth user with email_confirm=true so they can sign in via magic link,
      // no password yet (they'll set it on first sign-in). Note: we intentionally do
      // NOT send Supabase's default invite email.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { role: 'INVESTOR', full_name: email.split('@')[0] },
      });
      if (createErr || !created.user) {
        throw new HttpError(400, createErr?.message ?? 'Failed to create investor account');
      }
      investorId = created.user.id;
      isNewInvestor = true;
      // Belt-and-braces: make sure profiles.role is INVESTOR (trigger should handle it)
      await admin
        .from('profiles')
        .update({ role: 'INVESTOR' })
        .eq('id', investorId);
    }

    // 2. Create the invite row (unique per project+email+round)
    const { data: inviteRow, error: inviteError } = await supabase
      .from('invites')
      .insert({
        project_id: projectId,
        email,
        investor_id: investorId,
        invited_by: user.id,
        status: 'INVITED',
        min_units: minUnits,
        is_new_investor: isNewInvestor,
        round_id: roundId,
      })
      .select(
        'id, project_id, email, investor_id, status, amount_minor, projected_profit_minor, min_units, is_new_investor, created_at',
      )
      .single();

    if (inviteError) {
      if (inviteError.code === '23505') {
        throw new HttpError(400, 'This email has already been invited to this raise');
      }
      throw new HttpError(400, inviteError.message);
    }

    const appUrl = Deno.env.get('APP_URL') ?? 'https://ribhshare.com';
    if (!Deno.env.get('APP_URL')) {
      console.warn('APP_URL secret is unset — invite links fall back to https://ribhshare.com');
    }
    const baseUrl = appUrl.replace(/\/$/, '');
    const managerName =
      // deno-lint-ignore no-explicit-any
      (project as any).profiles?.full_name ?? 'Your project manager';

    // 3. Existing investors need no sign-in code — the request lands in
    // their dashboard and their usual password works. Only brand-new
    // accounts go through the code + first-signin flow.
    if (!isNewInvestor) {
      await admin.from('notifications').insert({
        user_id: investorId,
        type: 'INVITE_RECEIVED',
        title: 'New investment request',
        body: `${project.name} — additional units are open for you to pledge`,
        project_id: projectId,
        entity_id: inviteRow.id,
        href: `/(tabs)/projects/${projectId}?invite=${inviteRow.id}`,
      });

      const { subject, html, text } = renderExistingInvestorInviteEmail({
        projectName: project.name,
        managerName,
        signInUrl: baseUrl,
        minUnits,
      });

      try {
        await sendEmailViaResend({ to: email, subject, html, text });
      } catch (sendErr) {
        // In-app request already exists; the email is a courtesy heads-up.
        const message = sendErr instanceof Error ? sendErr.message : 'Unknown email error';
        return jsonResponse({ invite: inviteRow, emailSent: false, emailError: message });
      }
      return jsonResponse({ invite: inviteRow, emailSent: true });
    }

    // 3b. New investor: generate a first-signin code (secure server-side RPC)
    const { data: codeData, error: codeErr } = await admin.rpc('generate_invite_signin_code', {
      p_invite_id: inviteRow.id,
    });
    if (codeErr || !codeData) {
      throw new HttpError(500, `Failed to generate sign-in code: ${codeErr?.message ?? 'unknown'}`);
    }
    const code = String(codeData);

    // 4. Send email via Resend
    const signInUrl = `${baseUrl}/first-signin?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;

    const { subject, html, text } = renderInviteEmail({
      projectName: project.name,
      managerName,
      code,
      signInUrl,
      minUnits,
    });

    try {
      await sendEmailViaResend({ to: email, subject, html, text });
    } catch (sendErr) {
      // Don't fail the whole request — the invite is created and the LM can share
      // the code manually. But surface the error to the caller so they know email
      // didn't go out (e.g. domain not verified).
      const message = sendErr instanceof Error ? sendErr.message : 'Unknown email error';
      return jsonResponse({
        invite: inviteRow,
        emailSent: false,
        emailError: message,
        signinCode: code,
      });
    }

    return jsonResponse({
      invite: inviteRow,
      emailSent: true,
      // Do NOT include the code in the response on success. LM should not see it.
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (error instanceof Error && error.message === 'Missing Authorization header') {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }
    return errorResponse(error);
  }
});
