// create-user — CEO invites a Line Manager.
//
// Product rules:
//   * Only the CEO can create Line Managers (investors join via project
//     invitations from Line Managers — see send-invitation).
//   * No password is generated. The new manager receives an email with a
//     one-time 8-character sign-in code (14-day expiry) and sets their own
//     password on first sign-in — identical UX to investor invitations.
//   * The code is also returned to the CEO so it can be shared manually if
//     the email doesn't arrive.

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
    assertRole(role, ['CEO'], 'Only the CEO can create line managers');

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.fullName ?? '').trim();

    if (!email || !isValidEmail(email)) {
      throw new HttpError(400, 'Valid email is required');
    }
    if (fullName.length < 2) {
      throw new HttpError(400, 'Full name must be at least 2 characters');
    }

    const admin = createServiceClient();

    // 1. Create the auth user without a password — they set their own after
    // redeeming the sign-in code. handle_new_user creates the profile row.
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: 'LINE_MANAGER' },
    });
    if (error) {
      const message = error.message.includes('already')
        ? 'A user with this email already exists'
        : error.message;
      throw new HttpError(400, message);
    }
    if (!data.user) {
      throw new HttpError(500, 'User creation failed');
    }

    // 2. Generate the one-time sign-in code (secure server-side RPC).
    const { data: codeData, error: codeErr } = await admin.rpc('generate_staff_signin_code', {
      p_user_id: data.user.id,
    });
    if (codeErr || !codeData) {
      throw new HttpError(500, `Could not generate sign-in code: ${codeErr?.message ?? 'unknown'}`);
    }
    const code = String(codeData);

    // 3. Email the invitation.
    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
    const signInUrl = `${appUrl}/first-signin?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
    const { subject, html, text } = renderStaffInviteEmail({
      fullName,
      roleLabel: 'Line Manager',
      code,
      signInUrl,
    });

    let emailSent = false;
    let emailError: string | null = null;
    try {
      await sendEmailViaResend({ to: email, subject, html, text });
      emailSent = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
    }

    return jsonResponse({
      userId: data.user.id,
      email,
      fullName,
      role: 'LINE_MANAGER',
      emailSent,
      emailError,
      signinCode: code,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
