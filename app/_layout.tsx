import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { enableScreens } from 'react-native-screens';
import 'react-native-reanimated';
import { AppProviders } from '@/src/providers/AppProviders';
import { useAuthStore } from '@/src/store/useAuthStore';
import { routes } from '@/src/constants/routes';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';

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
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  useEffect(() => {
    if (!isInitialized) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const authScreen = inAuthGroup ? String(segments[1] ?? '') : '';
    const onPublicAuthScreen = PUBLIC_AUTH_SCREENS.has(authScreen);

    // Invited users mid first-signin → set-password hold a session on purpose.
    if (mustSetPassword) return;

    // Always allow the login / invite / password screens — do not auto-skip
    // sign-in just because a prior session was restored from storage.
    if (onPublicAuthScreen) return;

    if (!session && !inAuthGroup) {
      router.replace(routes.SIGN_IN);
    }
  }, [session, isInitialized, segments, router, mustSetPassword]);

  if (!isInitialized) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.background,
        }}
      >
        <ActivityIndicator color={palette.primary} />
      </View>
    );
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
