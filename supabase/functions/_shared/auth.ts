import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './errors.ts';

export type UserRole = 'CEO' | 'ADMIN' | 'LINE_MANAGER' | 'INVESTOR' | 'PROJECT_OWNER';

export async function getUserRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRole> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data?.role) {
    throw new HttpError(403, 'Profile not found');
  }
  return data.role as UserRole;
}

export function assertRole(role: UserRole, allowed: UserRole[], message: string) {
  if (!allowed.includes(role)) {
    throw new HttpError(403, message);
  }
}

export function isCeoOrAdmin(role: UserRole): boolean {
  return role === 'CEO' || role === 'ADMIN';
}
