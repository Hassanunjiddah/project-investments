import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { enableScreens } from 'react-native-screens';
import 'react-native-reanimated';
import { AppProviders } from '@/src/providers/AppProviders';
import { useAuthStore } from '@/src/store/useAuthStore';
import { routes } from '@/src/constants/routes';
import { BootSplash, dismissHtmlBootSplash } from '@/src/components/ui/BootSplash';
import { RootErrorBoundary } from '@/src/components/ui/RootErrorBoundary';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { roleCanAccessTab, tabNameFromSegments } from '@/src/helpers/roleAccess';
import { isGateUnlocked, setGateUnlocked } from '@/src/constants/session';
import { injectWebViewportCss } from '@/src/utils/webViewport';
import { WebFlexFill } from '@/src/components/nav/WebFlexFill';

if (Platform.OS === 'web') {
  injectWebViewportCss();
}

/**
 * Native: react-native-screens for real native containers.
 * Web: DISABLED. The screens web shim drops the `absoluteFill` style that
 * react-navigation puts on each tab scene, so scenes grow to content height
 * inside the overflow-hidden tab view — nothing can ever scroll. With screens
 * off, react-navigation falls back to plain Views that keep scenes bounded.
 * (Projects blanking is handled by Slot layouts + detachInactiveScreens.)
 */
enableScreens(Platform.OS !== 'web');

SplashScreen.preventAutoHideAsync();

// Web: never leave the native/HTML splash stuck if auth init hangs.
if (Platform.OS === 'web') {
  setTimeout(() => {
    SplashScreen.hideAsync().catch(() => undefined);
    dismissHtmlBootSplash();
  }, 8000);
}

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
  const unlocked = isGateUnlocked();

  const inAuthGroup = segments[0] === '(auth)';
  const authScreen = inAuthGroup ? String(segments[1] ?? '') : '';
  const onSetPassword = authScreen === 'set-password';
  const onResetPassword = authScreen === 'reset-password';
  const onFirstSignin = authScreen === 'first-signin';
  const onForgotPassword = authScreen === 'forgot-password';
  const onPublicAuthScreen = PUBLIC_AUTH_SCREENS.has(authScreen);
  const tabName = tabNameFromSegments(segments);

  // Password / recovery gates only after this tab was unlocked.
  const needsPasswordGate =
    isInitialized &&
    unlocked &&
    !!session &&
    mustSetPassword &&
    !onSetPassword &&
    !onFirstSignin;

  const needsResetGate =
    isInitialized && unlocked && !!session && mustResetPassword && !onResetPassword;

  // Wait for profile role before mounting tabs — otherwise expo-router blanks
  // routes whose tab `href` is still null (e.g. /projects while role hydrates).
  const awaitingRole =
    isInitialized &&
    unlocked &&
    !!session &&
    !role &&
    !mustSetPassword &&
    !mustResetPassword &&
    !inAuthGroup;

  const [roleWaitExpired, setRoleWaitExpired] = useState(false);
  useEffect(() => {
    if (!awaitingRole) {
      setRoleWaitExpired(false);
      return;
    }
    const t = setTimeout(() => setRoleWaitExpired(true), 8000);
    return () => clearTimeout(t);
  }, [awaitingRole]);

  const redirectingToSignIn =
    isInitialized &&
    (!session || !unlocked) &&
    !mustSetPassword &&
    !mustResetPassword &&
    !inAuthGroup;

  // Investor on /dashboard (etc.) — bounce before the wrong shell paints.
  const wrongTab =
    isInitialized &&
    unlocked &&
    !!session &&
    !!role &&
    !mustSetPassword &&
    !mustResetPassword &&
    !!tabName &&
    !roleCanAccessTab(role, tabName);

  // Only bounce off sign-in when this tab was unlocked with a password.
  // Never auto-enter the workspace from a restored cookie/token alone.
  const bounceFromAuth =
    isInitialized &&
    unlocked &&
    !!session &&
    !mustSetPassword &&
    !mustResetPassword &&
    inAuthGroup &&
    (authScreen === 'sign-in' || authScreen === 'staff-sign-in');

  useEffect(() => {
    if (!isInitialized) return;

    SplashScreen.hideAsync();
    dismissHtmlBootSplash();

    if (onFirstSignin || onForgotPassword) return;

    if (!unlocked && !inAuthGroup && !onPublicAuthScreen) {
      router.replace(routes.SIGN_IN);
      return;
    }

    if (unlocked && session && mustResetPassword && !onResetPassword) {
      router.replace('/(auth)/reset-password' as never);
      return;
    }

    if (unlocked && session && mustSetPassword && !onSetPassword) {
      router.replace('/(auth)/set-password' as never);
      return;
    }

    if (bounceFromAuth && role) {
      router.replace(getDefaultTabRoute(role));
      return;
    }

    if (wrongTab && role) {
      router.replace(getDefaultTabRoute(role));
      return;
    }

    if (!session && !inAuthGroup && !onPublicAuthScreen) {
      router.replace(routes.SIGN_IN);
    }

    if (roleWaitExpired && awaitingRole) {
      setGateUnlocked(false);
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
    bounceFromAuth,
    unlocked,
    role,
    roleWaitExpired,
    awaitingRole,
  ]);

  if (!isInitialized) {
    return <BootSplash message="Loading…" />;
  }

  if (needsResetGate) {
    return <BootSplash message="Finish resetting your password…" />;
  }

  if (needsPasswordGate) {
    return <BootSplash message="Finish setting your password…" />;
  }

  if (awaitingRole) {
    return (
      <BootSplash
        message={
          roleWaitExpired
            ? 'Could not load your workspace. Taking you back to sign in…'
            : 'Opening your workspace…'
        }
      />
    );
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
    <WebFlexFill label="root">
      <RootErrorBoundary>
        <AppProviders>
          <AuthGuard>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { flex: 1, height: '100%' },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthGuard>
          <StatusBar style="auto" />
        </AppProviders>
      </RootErrorBoundary>
    </WebFlexFill>
  );
}
