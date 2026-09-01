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
   * True only while finishing an invitation redeem (set password).
   * Never set from a normal email/password sign-in — that path already
   * proved they have a password. AuthGuard blocks tabs until this is false.
   */
  mustSetPassword: boolean;
  /**
   * True while finishing a password-recovery flow. AuthGuard keeps the user
   * on /reset-password until they save a new password.
   */
  mustResetPassword: boolean;
  setSession: (session: Session | null) => void;
  setRole: (role: Role | null) => void;
  setInitialized: (initialized: boolean) => void;
  updateUser: (user: Profile | null) => void;
  setMustSetPassword: (v: boolean) => void;
  setMustResetPassword: (v: boolean) => void;
  /** Apply profile; clear the password gate once passwordSetAt is present. */
  applyProfile: (profile: Profile) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  isInitialized: false,
  mustSetPassword: false,
  mustResetPassword: false,
  setSession: (session) =>
    set((state) => {
      const sameUser = !!(state.user && session?.user?.id && state.user.id === session.user.id);
      return {
        session,
        user: sameUser ? state.user : null,
        role: sameUser ? state.role : null,
        // Keep invite / recovery gates across session handoff. Only drop on sign-out.
        mustSetPassword: session ? state.mustSetPassword : false,
        mustResetPassword: session ? state.mustResetPassword : false,
      };
    }),
  setRole: (role) => set({ role }),
  updateUser: (user) => set({ user }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setMustSetPassword: (mustSetPassword) => set({ mustSetPassword }),
  setMustResetPassword: (mustResetPassword) => set({ mustResetPassword }),
  applyProfile: (profile) =>
    set((state) => ({
      user: profile,
      role: profile.role,
      // Only invite redeem turns the gate on. Profile sync may turn it off
      // after password_set_at is written — never re-open it on cold start.
      mustSetPassword: profile.passwordSetAt ? false : state.mustSetPassword,
    })),
  reset: () =>
    set({
      session: null,
      user: null,
      role: null,
      isInitialized: true,
      mustSetPassword: false,
      mustResetPassword: false,
    }),
}));
