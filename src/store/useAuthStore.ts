import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
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
    // Only stash the session on the store; do NOT fabricate a user profile
    // with a default role. The real profile (with real role) is loaded via
    // `updateUser` once the profiles row is fetched. This avoids the
    // long-standing foot-gun where LM/CEO logins were briefly treated as
    // INVESTOR between session-hydrate and profile-fetch.
    set((state) => ({
      session,
      // Preserve any existing user object if the session refresh matches the
      // same auth user; otherwise clear it and let profile loader repopulate.
      user: state.user && state.user.id === session?.user.id ? state.user : null,
      role: state.user && state.user.id === session?.user.id ? state.role : null,
    })),
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
