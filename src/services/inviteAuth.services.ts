import { supabase } from '@/src/services/supabase';
import { AppError } from '@/src/helpers/supabaseError';

export type RedeemInviteCodeResult = {
  email: string;
  tokenHash: string;
  inviteId: string;
  projectId: string;
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

// After redeem-invite-code succeeds, exchange the tokenHash for a real session.
export async function verifyMagicToken(email: string, tokenHash: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token_hash: tokenHash,
    type: 'magiclink',
  });
  if (error) throw new AppError(error.message);
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
