import type { Session } from '@supabase/supabase-js';
import type { SignInInput } from '@/src/types/auth.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import { SITE_URL } from '@/src/constants/site';

export async function signInWithPassword(input: SignInInput): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) throw normalizeError(error);
  if (!data.session) throw normalizeError(new Error('No session returned'));

  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw normalizeError(error);
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw normalizeError(error);
  return data.session;
}

/** Always succeeds from the caller's POV (enumerate-safe). */
export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/reset-password`
      : `${SITE_URL.replace(/\/$/, '')}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  // Swallow most errors so we never reveal whether the email exists.
  // Still throw hard network failures so the UI can show connectivity help.
  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      msg.includes('offline') ||
      msg.includes('load failed')
    ) {
      throw normalizeError(error);
    }
  }
}

/** Exchange a recovery `code` (PKCE) for a session. */
export async function exchangeRecoveryCode(code: string): Promise<Session> {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw normalizeError(error);
  if (!data.session) throw normalizeError(new Error('No session returned from recovery link'));
  return data.session;
}

/**
 * Hash-fragment recovery tokens (implicit flow). detectSessionInUrl is false,
 * so we must set the session manually from access_token + refresh_token.
 */
export async function setSessionFromRecoveryTokens(input: {
  accessToken: string;
  refreshToken: string;
}): Promise<Session> {
  const { data, error } = await supabase.auth.setSession({
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
  });
  if (error) throw normalizeError(error);
  if (!data.session) throw normalizeError(new Error('No session returned from recovery tokens'));
  return data.session;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw normalizeError(error);
}
