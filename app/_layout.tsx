import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { enableScreens } from 'react-native-screens';
import 'react-native-reanimated';
import { AppProviders } from '@/src/providers/AppProviders';
import { useAuthStore } from '@/src/store/useAuthStore';
import { routes } from '@/src/constants/routes';
import { BootSplash, dismissHtmlBootSplash } from '@/src/components/ui/BootSplash';

/**
 * react-native-screens defaults to off on web. Without it, inactive tabs stay
 * mounted as absoluteFill views (only zIndex:-1) and paint through each other —
 * desktop rail clicks look blank / stuck on Home. Enabling screens applies
 * display:none to inactive tab scenes on web.
 */
enableScreens(true);

SplashScreen.preventAutoHideAsync();

/** Auth screens that stay reachable even with an existing session
 *  (sign-in landing, invite links, account switch, first-time password). */
const PUBLIC_AUTH_SCREENS = new Set(['sign-in', 'first-signin', 'set-password']);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isInitialized, mustSetPassword } = useAuthStore();

  const inAuthGroup = segments[0] === '(auth)';
  const authScreen = inAuthGroup ? String(segments[1] ?? '') : '';
  const onPublicAuthScreen = PUBLIC_AUTH_SCREENS.has(authScreen);
  // Protected route without a session — keep the branded splash up while we
  // replace to sign-in (never flash an empty tabs shell).
  const redirectingToSignIn =
    isInitialized && !mustSetPassword && !session && !inAuthGroup && !onPublicAuthScreen;

  useEffect(() => {
    if (!isInitialized) return;

    SplashScreen.hideAsync();
    dismissHtmlBootSplash();

    if (mustSetPassword) return;
    if (onPublicAuthScreen) return;

    if (!session && !inAuthGroup) {
      router.replace(routes.SIGN_IN);
    }
  }, [session, isInitialized, segments, router, mustSetPassword, onPublicAuthScreen, inAuthGroup]);

  if (!isInitialized) {
    return <BootSplash message="Starting workspace…" />;
  }

  if (redirectingToSignIn) {
    return <BootSplash message="Taking you to sign in…" />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGuard>
      <StatusBar style="auto" />
    </AppProviders>
  );
}
