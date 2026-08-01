import { supabase } from '@/src/services/supabase';
import { AppError } from '@/src/helpers/supabaseError';

export type RedeemInviteCodeResult = {
  email: string;
  tokenHash: string;
  /** Null for staff (Line Manager) codes — those aren't tied to an invite/project. */
  inviteId: string | null;
  projectId: string | null;
  investorId: string;
  passwordAlreadySet: boolean;
};

// Calls the redeem-invite-code edge function which verifies (email, code)
// and returns a token hash the client can pass to supabase.auth.verifyOtp.
export async function redeemInviteCode(input: {
  email: string;
  code: string;
}): Promise<RedeemInviteCodeResult> {
  const baseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const res = await fetch(`${baseUrl}/functions/v1/redeem-invite-code`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      code: input.code.trim().toUpperCase(),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as
    | RedeemInviteCodeResult
    | { error?: string };

  if (!res.ok) {
    const message =
      typeof (json as { error?: string }).error === 'string'
        ? (json as { error: string }).error
        : 'Invalid email or code';
    throw new AppError(message);
  }

  return json as RedeemInviteCodeResult;
}

/**
 * Exchange a redeem token for a session for the invited account.
 * Always clears any existing session first — otherwise opening an invite
 * email on a device already signed in as investor A leaves A logged in.
 */
export async function verifyMagicToken(_email: string, tokenHash: string): Promise<void> {
  // Drop the previous session so verifyOtp cannot attach to the wrong user.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);

  // NOTE: Supabase Auth requires ONLY token_hash + type for token-hash based OTP verification;
  // passing `email` alongside triggers a 400 "Only the token_hash and type should be provided".
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (error) throw new AppError(error.message);

  const sessionEmail = data.session?.user?.email?.toLowerCase();
  const expected = _email.trim().toLowerCase();
  if (sessionEmail && expected && sessionEmail !== expected) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    throw new AppError(
      `Signed-in account (${sessionEmail}) does not match the invitation (${expected}). Try again.`,
    );
  }
}

// Sets the user's password + marks profiles.password_set_at.
export async function setPasswordAndMark(newPassword: string): Promise<void> {
  const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updErr) throw new AppError(updErr.message);

  const { error: rpcErr } = await (supabase.rpc as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)('mark_password_set', { p_user_id: null });
  if (rpcErr) {
    // Non-blocking: the password IS set at the auth level even if the mark fails.
    console.warn('mark_password_set failed', rpcErr);
  }
}
