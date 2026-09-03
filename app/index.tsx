import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { BootSplash } from '@/src/components/ui/BootSplash';
import { routes } from '@/src/constants/routes';
import { isGateUnlocked } from '@/src/constants/session';

/**
 * Site entry always opens sign-in. A restored token is never enough to
 * enter the workspace — the user must unlock with their password in this tab.
 */
export default function Index() {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const mustSetPassword = useAuthStore((s) => s.mustSetPassword);
  const mustResetPassword = useAuthStore((s) => s.mustResetPassword);

  if (!isInitialized) {
    return <BootSplash message="Loading…" />;
  }

  // Invite / recovery flows still need the gated screens.
  if (mustResetPassword && isGateUnlocked()) {
    return <Redirect href={'/(auth)/reset-password' as never} />;
  }

  if (mustSetPassword && isGateUnlocked()) {
    return <Redirect href={'/(auth)/set-password' as never} />;
  }

  return <Redirect href={routes.SIGN_IN as never} />;
}
