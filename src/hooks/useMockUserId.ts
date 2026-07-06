import { useAuthStore } from '@/src/store/useAuthStore';
import { getMockUserIdForRole } from '@/db/selectors';

export function useMockUserId(): string {
  const role = useAuthStore((s) => s.role);
  return getMockUserIdForRole(role);
}
