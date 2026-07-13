import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { getSession } from '@/src/services/auth.services';
import { fetchProfile } from '@/src/services/profile.services';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/store/useAuthStore';

type AuthProviderProps = {
  children: ReactNode;
};

async function syncProfileRole(userId: string) {
  try {
    const profile = await fetchProfile(userId);
    useAuthStore.getState().setRole(profile.role);
    useAuthStore.getState().updateUser(profile);
  } catch {
    useAuthStore.getState().setRole(null);
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setSession, setInitialized } = useAuthStore();

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const session = await getSession();
        if (!mounted) return;
        setSession(session);
        if (session?.user) {
          await syncProfileRole(session.user.id);
        }
      } finally {
        if (mounted) setInitialized(true);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        await syncProfileRole(session.user.id);
      } else {
        useAuthStore.getState().setRole(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setSession, setInitialized]);

  return <>{children}</>;
}
