import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';
import { BootSplash } from '@/src/components/ui/BootSplash';

/**
 * Site entry always opens sign-in — never skip past login because a session
 * was restored from storage. Post-login navigation is handled by SignInScreen.
 */
export default function Index() {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const mustSetPassword = useAuthStore((s) => s.mustSetPassword);

  if (!isInitialized) {
    return <BootSplash message="Starting workspace…" />;
  }

  if (mustSetPassword) {
    return <Redirect href={'/(auth)/set-password' as never} />;
  }

  return <Redirect href={'/(auth)/sign-in' as never} />;
}
