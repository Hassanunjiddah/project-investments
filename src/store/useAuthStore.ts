import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Role } from '@/src/constants/roles';
import type { Profile } from '@/src/types/profile.types';

type AuthState = {
  session: Session | null;
  user: Profile | null;
  role: Role | null;
  isInitialized: boolean;
  /**
   * True when the signed-in user still owes a first password
   * (`profiles.password_set_at` is null) or during invite redeem.
   * AuthGuard blocks every tab until this is false.
   */
  mustSetPassword: boolean;
  setSession: (session: Session | null) => void;
  setRole: (role: Role | null) => void;
  setInitialized: (initialized: boolean) => void;
  updateUser: (user: Profile | null) => void;
  setMustSetPassword: (v: boolean) => void;
  /** Apply profile + derive mustSetPassword from passwordSetAt. */
  applyProfile: (profile: Profile) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  isInitialized: false,
  mustSetPassword: false,
  setSession: (session) =>
    set((state) => ({
      session,
      user: state.user && state.user.id === session?.user.id ? state.user : null,
      role: state.user && state.user.id === session?.user.id ? state.role : null,
      // New principal → re-evaluate password gate once profile loads.
      mustSetPassword:
        state.user && state.user.id === session?.user.id
          ? state.mustSetPassword
          : false,
    })),
  setRole: (role) => set({ role }),
  updateUser: (user) => set({ user }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setMustSetPassword: (mustSetPassword) => set({ mustSetPassword }),
  applyProfile: (profile) =>
    set({
      user: profile,
      role: profile.role,
      mustSetPassword: !profile.passwordSetAt,
    }),
  reset: () =>
    set({
      session: null,
      user: null,
      role: null,
      isInitialized: true,
      mustSetPassword: false,
    }),
}));
