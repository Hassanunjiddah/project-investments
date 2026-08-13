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

const PUBLIC_AUTH_SCREENS = new Set(['sign-in', 'first-signin', 'set-password']);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isInitialized, mustSetPassword } = useAuthStore();

  const inAuthGroup = segments[0] === '(auth)';
  const authScreen = inAuthGroup ? String(segments[1] ?? '') : '';
  const onSetPassword = authScreen === 'set-password';
  const onFirstSignin = authScreen === 'first-signin';
  const onPublicAuthScreen = PUBLIC_AUTH_SCREENS.has(authScreen);

  // Session exists but password not set → only /set-password (and first-signin) allowed.
  const needsPasswordGate =
    isInitialized && !!session && mustSetPassword && !onSetPassword && !onFirstSignin;

  const redirectingToSignIn =
    isInitialized && !session && !mustSetPassword && !inAuthGroup;

  useEffect(() => {
    if (!isInitialized) return;

    SplashScreen.hideAsync();
    dismissHtmlBootSplash();

    // Invited users mid first-signin own the flow.
    if (onFirstSignin) return;

    // Hard gate: no tabs / no plain sign-in until password is set.
    if (session && mustSetPassword && !onSetPassword) {
      router.replace('/(auth)/set-password' as never);
      return;
    }

    if (!session && !inAuthGroup && !onPublicAuthScreen) {
      router.replace(routes.SIGN_IN);
    }
  }, [
    session,
    isInitialized,
    segments,
    router,
    mustSetPassword,
    onFirstSignin,
    onSetPassword,
    inAuthGroup,
    onPublicAuthScreen,
  ]);

  if (!isInitialized) {
    return <BootSplash message="Starting workspace…" />;
  }

  if (needsPasswordGate) {
    return <BootSplash message="Finish setting your password…" />;
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
