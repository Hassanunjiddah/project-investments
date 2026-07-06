import type { Session } from '@supabase/supabase-js';
import type { SignInInput } from '@/src/types/auth.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

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
