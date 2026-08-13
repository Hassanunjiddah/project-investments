import type { Role } from '@/src/constants/roles';

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  /** Null until the invited user completes /set-password. */
  passwordSetAt?: string | null;
};

export type ProfileUpdate = Partial<Pick<Profile, 'fullName' | 'avatarUrl'>>;
