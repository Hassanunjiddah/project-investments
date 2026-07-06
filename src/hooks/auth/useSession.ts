import { useAuthStore } from '@/src/store/useAuthStore';

export function useSession() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  return { session, user, role, isInitialized };
}
