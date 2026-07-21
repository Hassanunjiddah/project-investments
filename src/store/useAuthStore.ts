import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Role } from '@/src/constants/roles';
import type { Profile } from '@/src/types/profile.types';

type AuthState = {
  session: Session | null;
  user: Profile | null;
  role: Role | null;
  isInitialized: boolean;
  // True while an invited investor is between verifyOtp and setPassword. Lets
  // FirstSigninScreen own routing so the AuthGuard doesn't race the redirect
  // to /set-password.
  mustSetPassword: boolean;
  setSession: (session: Session | null) => void;
  setRole: (role: Role | null) => void;
  setInitialized: (initialized: boolean) => void;
  updateUser: (user: Profile | null) => void;
  setMustSetPassword: (v: boolean) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  isInitialized: false,
  mustSetPassword: false,
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
  setMustSetPassword: (mustSetPassword) => set({ mustSetPassword }),
  reset: () =>
    set({
      session: null,
      user: null,
      role: null,
      isInitialized: true,
      mustSetPassword: false,
    }),
}));
