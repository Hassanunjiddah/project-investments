import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import type { Role } from '@/src/constants/roles';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { BootSplash } from '@/src/components/ui/BootSplash';

type Props = {
  /** Roles allowed to see this screen. */
  allow: Role[];
  children: ReactNode;
  /** Shown while role is still hydrating. */
  pendingMessage?: string;
};

/**
 * Hard screen gate — if the signed-in role is not in `allow`, bounce to that
 * role's home. Prevents an investor from ever rendering a CEO/LM screen even
 * if a deep link or stale navigation reaches the route.
 */
export function RoleGate({
  allow,
  children,
  pendingMessage = 'Checking access…',
}: Props) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const role = useAuthStore((s) => s.role);
  const session = useAuthStore((s) => s.session);

  const allowed = !!role && allow.includes(role);

  useEffect(() => {
    if (!isFocused) return;
    if (!session) return;
    if (!role) return;
    if (!allowed) {
      router.replace(getDefaultTabRoute(role));
    }
  }, [isFocused, session, role, allowed, router]);

  if (!isFocused && !allowed) {
    return null;
  }

  if (!role) {
    return <BootSplash message={pendingMessage} />;
  }

  if (!allowed) {
    return <BootSplash message="Redirecting to your workspace…" />;
  }

  return <>{children}</>;
}
