import type { Role } from '@/src/constants/roles';

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarUrl?: string;
};

export type ProfileUpdate = Partial<Pick<Profile, 'fullName' | 'avatarUrl'>>;
