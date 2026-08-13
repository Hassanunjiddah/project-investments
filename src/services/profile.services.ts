import type { Database } from '@/src/types/supabase.types';
import type { Role } from '@/src/constants/roles';
import type { Profile, ProfileUpdate } from '@/src/types/profile.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

const PROFILE_SELECT = 'id, full_name, email, role, avatar_url, password_set_at';

function mapRowToProfile(row: {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  password_set_at?: string | null;
}): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role as Role,
    avatarUrl: row.avatar_url ?? undefined,
    passwordSetAt: row.password_set_at ?? null,
  };
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProfile(data);
}

export async function updateProfile(userId: string, patch: ProfileUpdate): Promise<Profile> {
  const update: Database['public']['Tables']['profiles']['Update'] = {};
  if (patch.fullName !== undefined) update.full_name = patch.fullName;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl || null;

  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select(PROFILE_SELECT)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProfile(data);
}

export async function fetchInvestors(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('role', 'INVESTOR')
    .order('full_name');

  if (error) throw normalizeError(error);
  return (data ?? []).map(mapRowToProfile);
}

export async function fetchManagedUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('role', ['INVESTOR', 'LINE_MANAGER', 'CEO'])
    .order('role')
    .order('full_name');

  if (error) throw normalizeError(error);
  return (data ?? []).map(mapRowToProfile);
}
