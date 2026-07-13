import { handleCors } from '../_shared/cors.ts';
import { createUserClient, createServiceClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { generateSimplePassword, isValidEmail } from '../_shared/password.ts';

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

    if (!projectId) throw new HttpError(400, 'projectId is required');
    if (!email || !isValidEmail(email)) {
      throw new HttpError(400, 'Valid email is required');
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, approval_status, created_by')
      .eq('id', projectId)
      .single();

    if (projectError || !project) throw new HttpError(404, 'Project not found');
    if (project.approval_status !== 'APPROVED') {
      throw new HttpError(400, 'Project must be approved before inviting investors');
    }
    if (role === 'LINE_MANAGER' && project.created_by !== user.id) {
      throw new HttpError(403, 'Line managers can only invite on their own projects');
    }

    const admin = createServiceClient();
    let investorId: string;
    let newAccount: { email: string; password: string } | null = null;

    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();

    if (profileError) throw new HttpError(400, profileError.message);

    if (existingProfile) {
      if (existingProfile.role !== 'INVESTOR') {
        throw new HttpError(400, 'This email belongs to a non-investor account');
      }
      investorId = existingProfile.id;
    } else {
      const password = generateSimplePassword();

      const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        email,
        {
          data: { role: 'INVESTOR', full_name: email.split('@')[0] },
        },
      );

      if (inviteError || !invitedUser.user) {
        const message = inviteError?.message.includes('already')
          ? 'A user with this email already exists'
          : (inviteError?.message ?? 'Failed to create investor account');
        throw new HttpError(400, message);
      }

      investorId = invitedUser.user.id;

      const { error: passwordError } = await admin.auth.admin.updateUserById(investorId, {
        password,
      });

      if (passwordError) {
        throw new HttpError(400, passwordError.message);
      }

      newAccount = { email, password };
    }

    const { data, error } = await supabase
      .from('invites')
      .insert({
        project_id: projectId,
        email,
        investor_id: investorId,
        invited_by: user.id,
        status: 'INVITED',
      })
      .select(
        'id, project_id, email, investor_id, status, amount_kobo, projected_profit_kobo, created_at',
      )
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new HttpError(400, 'This email has already been invited to this project');
      }
      throw new HttpError(400, error.message);
    }

    return jsonResponse({ invite: data, newAccount });
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
