import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { getSession } from '@/src/services/auth.services';
import { fetchProfile } from '@/src/services/profile.services';
import { supabase } from '@/src/services/supabase';
import { useAuthStore } from '@/src/store/useAuthStore';
import { appQueryClient } from '@/src/providers/QueryProvider';

type AuthProviderProps = {
  children: ReactNode;
};

async function syncProfileRole(userId: string) {
  try {
    const profile = await fetchProfile(userId);
    useAuthStore.getState().applyProfile(profile);
  } catch {
    // Keep any role already set (e.g. by SignInScreen) so tab hrefs stay
    // valid — clearing to null hides every tab and leaves a blank shell.
    const existing = useAuthStore.getState().role;
    if (!existing) {
      useAuthStore.getState().setRole(null);
    }
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { setSession, setInitialized } = useAuthStore();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const session = await getSession();
        if (!mounted) return;
        setSession(session);
        lastUserIdRef.current = session?.user?.id ?? null;
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const nextId = session?.user?.id ?? null;
      const prevId = lastUserIdRef.current;

      // Drop cached queries whenever the signed-in principal changes so
      // investor B never briefly sees investor A's portfolio / LM shell data.
      if (event === 'SIGNED_OUT' || (prevId && nextId && prevId !== nextId) || (prevId && !nextId)) {
        appQueryClient.clear();
      }
      if (event === 'SIGNED_IN' && prevId && nextId && prevId !== nextId) {
        appQueryClient.clear();
        // Hard-clear role immediately so the previous principal's shell
        // cannot paint for even one frame.
        useAuthStore.getState().setRole(null);
        useAuthStore.getState().updateUser(null);
      }

      if (event === 'PASSWORD_RECOVERY') {
        useAuthStore.getState().setMustResetPassword(true);
      }

      lastUserIdRef.current = nextId;
      setSession(session);

      if (session?.user) {
        await syncProfileRole(session.user.id);
      } else {
        useAuthStore.getState().setRole(null);
        useAuthStore.getState().updateUser(null);
        useAuthStore.getState().setMustSetPassword(false);
        useAuthStore.getState().setMustResetPassword(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setSession, setInitialized]);

  return <>{children}</>;
}
