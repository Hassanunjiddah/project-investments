import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Role } from '@/src/constants/roles';

type AuthState = {
  session: Session | null;
  user: User | null;
  role: Role | null;
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
  setRole: (role: Role | null) => void;
  setInitialized: (initialized: boolean) => void;
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
      user: session?.user ?? null,
    }),
  setRole: (role) => set({ role }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  reset: () =>
    set({
      session: null,
      user: null,
      role: null,
      isInitialized: true,
    }),
}));
