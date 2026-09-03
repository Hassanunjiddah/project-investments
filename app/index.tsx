import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { BootSplash } from '@/src/components/ui/BootSplash';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { routes } from '@/src/constants/routes';

/**
 * Site entry: restore into the workspace when a session already exists;
 * otherwise open investor sign-in.
 */
export default function Index() {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const role = useAuthStore((s) => s.role);
  const mustSetPassword = useAuthStore((s) => s.mustSetPassword);
  const mustResetPassword = useAuthStore((s) => s.mustResetPassword);

  if (!isInitialized) {
    return <BootSplash message="Starting workspace…" />;
  }

  if (mustResetPassword) {
    return <Redirect href={'/(auth)/reset-password' as never} />;
  }

  if (mustSetPassword) {
    return <Redirect href={'/(auth)/set-password' as never} />;
  }

  if (session) {
    return <Redirect href={getDefaultTabRoute(role)} />;
  }

  return <Redirect href={routes.SIGN_IN as never} />;
}
