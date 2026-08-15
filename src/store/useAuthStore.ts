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
  setSession: (session: Session | null) => void;
  setRole: (role: Role | null) => void;
  setInitialized: (initialized: boolean) => void;
  updateUser: (user: Profile | null) => void;
  setMustSetPassword: (v: boolean) => void;
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
  setSession: (session) =>
    set((state) => {
      const sameUser = !!(state.user && session?.user?.id && state.user.id === session.user.id);
      return {
        session,
        user: sameUser ? state.user : null,
        role: sameUser ? state.role : null,
        // Keep invite password gate across magic-link handoff (user is cleared
        // briefly). Only drop the gate on full sign-out.
        mustSetPassword: session ? state.mustSetPassword : false,
      };
    }),
  setRole: (role) => set({ role }),
  updateUser: (user) => set({ user }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  setMustSetPassword: (mustSetPassword) => set({ mustSetPassword }),
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
    }),
}));
