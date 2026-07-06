import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { routes } from '@/src/constants/routes';
import { getDefaultTabRoute } from '@/src/helpers/routing';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  if (!isInitialized) return null;

  if (session) {
    const role = useAuthStore.getState().role;
    return <Redirect href={getDefaultTabRoute(role)} />;
  }

  return <Redirect href={routes.SIGN_IN} />;
}
