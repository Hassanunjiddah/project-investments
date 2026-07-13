import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Role } from '@/src/constants/roles';
import type { Profile } from '@/src/types/profile.types';

type AuthState = {
  session: Session | null;
  user: Profile | null;
  role: Role | null;
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
  setRole: (role: Role | null) => void;
  setInitialized: (initialized: boolean) => void;
  updateUser: (user: Profile | null) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  isInitialized: false,
  setSession: (session) =>
    set({
      session,
      user: {
        id: session?.user.id ?? '',
        fullName: session?.user.email ?? '',
        email: session?.user.email ?? '',
        role: 'INVESTOR' as Role,
      },
    }),
  setRole: (role) => set({ role }),
  updateUser: (user) => set({ user }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  reset: () =>
    set({
      session: null,
      user: null,
      role: null,
      isInitialized: true,
    }),
}));
