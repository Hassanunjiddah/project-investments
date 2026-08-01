import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { routes } from '@/src/constants/routes';
import { getDefaultTabRoute } from '@/src/helpers/routing';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const role = useAuthStore((s) => s.role);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const mustSetPassword = useAuthStore((s) => s.mustSetPassword);

  if (!isInitialized) return null;

  if (mustSetPassword) {
    return <Redirect href={'/(auth)/set-password' as never} />;
  }

  if (session) {
    // Wait for profile role so we never send a new investor to LM routes.
    if (!role) return null;
    return <Redirect href={getDefaultTabRoute(role)} />;
  }

  return <Redirect href={routes.SIGN_IN} />;
}
