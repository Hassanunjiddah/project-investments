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
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { roleCanAccessTab, tabNameFromSegments } from '@/src/helpers/roleAccess';

/**
 * react-native-screens defaults to off on web. Without it, inactive tabs stay
 * mounted as absoluteFill views (only zIndex:-1) and paint through each other —
 * desktop rail clicks look blank / stuck on Home. Enabling screens applies
 * display:none to inactive tab scenes on web.
 */
enableScreens(true);

SplashScreen.preventAutoHideAsync();

const PUBLIC_AUTH_SCREENS = new Set([
  'sign-in',
  'staff-sign-in',
  'first-signin',
  'set-password',
  'forgot-password',
  'reset-password',
]);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isInitialized, mustSetPassword, mustResetPassword, role } = useAuthStore();

  const inAuthGroup = segments[0] === '(auth)';
  const authScreen = inAuthGroup ? String(segments[1] ?? '') : '';
  const onSetPassword = authScreen === 'set-password';
  const onResetPassword = authScreen === 'reset-password';
  const onFirstSignin = authScreen === 'first-signin';
  const onForgotPassword = authScreen === 'forgot-password';
  const onPublicAuthScreen = PUBLIC_AUTH_SCREENS.has(authScreen);
  const tabName = tabNameFromSegments(segments);

  const needsPasswordGate =
    isInitialized && !!session && mustSetPassword && !onSetPassword && !onFirstSignin;

  const needsResetGate =
    isInitialized && !!session && mustResetPassword && !onResetPassword;

  const redirectingToSignIn =
    isInitialized && !session && !mustSetPassword && !mustResetPassword && !inAuthGroup;

  // Investor on /dashboard (etc.) — bounce before the wrong shell paints.
  const wrongTab =
    isInitialized &&
    !!session &&
    !!role &&
    !mustSetPassword &&
    !mustResetPassword &&
    !!tabName &&
    !roleCanAccessTab(role, tabName);

  useEffect(() => {
    if (!isInitialized) return;

    SplashScreen.hideAsync();
    dismissHtmlBootSplash();

    if (onFirstSignin || onForgotPassword) return;

    if (session && mustResetPassword && !onResetPassword) {
      router.replace('/(auth)/reset-password' as never);
      return;
    }

    if (session && mustSetPassword && !onSetPassword) {
      router.replace('/(auth)/set-password' as never);
      return;
    }

    if (wrongTab && role) {
      router.replace(getDefaultTabRoute(role));
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
    mustResetPassword,
    onFirstSignin,
    onForgotPassword,
    onSetPassword,
    onResetPassword,
    inAuthGroup,
    onPublicAuthScreen,
    wrongTab,
    role,
  ]);

  if (!isInitialized) {
    return <BootSplash message="Starting workspace…" />;
  }

  if (needsResetGate) {
    return <BootSplash message="Finish resetting your password…" />;
  }

  if (needsPasswordGate) {
    return <BootSplash message="Finish setting your password…" />;
  }

  if (wrongTab) {
    return <BootSplash message="Opening your workspace…" />;
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
