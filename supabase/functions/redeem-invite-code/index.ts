// redeem-invite-code
// Verifies (email, 8-char code) against the invites table, then issues a
// magic-link token the client can pass to supabase.auth.verifyOtp to get a
// real session. Marks the code as redeemed. Client should then force the user
// through the "set password" screen if `passwordAlreadySet` is false.

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabaseClient.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { isValidEmail } from '../_shared/password.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const code = String(body.code ?? '').trim().toUpperCase();

    if (!email || !isValidEmail(email)) throw new HttpError(400, 'Valid email is required');
    if (!code || code.length !== 8) throw new HttpError(400, 'A valid 8-character code is required');

    const admin = createServiceClient();

    // 1. Verify the code + email. Investor codes live on invites; staff codes
    // (Line Managers created by the CEO) live in staff_signin_codes. Try the
    // invite path first, then fall back to staff — both mark the code
    // redeemed atomically on success.
    let inviteId: string | null = null;
    let projectId: string | null = null;
    let userId: string | null = null;
    let passwordAlreadySet = false;

    const { data: redeemRows, error: redeemErr } = await admin.rpc('redeem_invite_signin_code', {
      p_email: email,
      p_code: code,
    });
    const redeem = Array.isArray(redeemRows) ? redeemRows[0] : redeemRows;

    if (!redeemErr && redeem) {
      inviteId = redeem.invite_id;
      projectId = redeem.project_id;
      userId = redeem.investor_id;
      passwordAlreadySet = !!redeem.password_already_set;
    } else {
      const { data: staffRows, error: staffErr } = await admin.rpc('redeem_staff_signin_code', {
        p_email: email,
        p_code: code,
      });
      const staff = Array.isArray(staffRows) ? staffRows[0] : staffRows;
      if (staffErr || !staff) {
        // Surface the most specific message (expired / already used) from
        // whichever path recognised the email+code pair.
        const inviteMsg = redeemErr?.message ?? 'Invalid email or code';
        const staffMsg = staffErr?.message ?? 'Invalid email or code';
        const specific =
          staffMsg !== 'Invalid email or code'
            ? staffMsg
            : inviteMsg !== 'Invalid email or code'
              ? inviteMsg
              : 'Invalid email or code';
        throw new HttpError(400, specific);
      }
      userId = staff.user_id;
      passwordAlreadySet = !!staff.password_already_set;
      // Project owners: deep-link set-password / home to their assigned project.
      const { data: owned } = await admin
        .from('projects')
        .select('id')
        .eq('project_owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (owned?.id) projectId = owned.id;
    }

    // 2. Generate a magic-link OTP so the client can exchange it for a session.
    // We use type=magiclink (not signup) since the user was created ahead of time
    // by send-invitation.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData?.properties) {
      throw new HttpError(500, linkErr?.message ?? 'Failed to generate sign-in link');
    }

    // Supabase returns { hashed_token, email_otp, action_link, ... }
    // The client uses `token_hash` + `email` + `type='magiclink'` on verifyOtp.
    const tokenHash =
      // deno-lint-ignore no-explicit-any
      (linkData.properties as any).hashed_token as string | undefined;
    if (!tokenHash) {
      throw new HttpError(500, 'Sign-in link is missing token_hash');
    }

    return jsonResponse({
      email,
      tokenHash,
      inviteId,
      projectId,
      investorId: userId,
      passwordAlreadySet,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
