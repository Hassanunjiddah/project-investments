import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { AppProviders } from '@/src/providers/AppProviders';
import { useAuthStore } from '@/src/store/useAuthStore';
import { routes } from '@/src/constants/routes';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';

SplashScreen.preventAutoHideAsync();

/** Auth screens that must remain reachable even with an existing session
 *  (invite email links / account switch / first-time password). */
const ACCOUNT_SWITCH_SCREENS = new Set(['first-signin', 'set-password']);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isInitialized, role, mustSetPassword } = useAuthStore();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  useEffect(() => {
    if (!isInitialized) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    const authScreen = inAuthGroup ? String(segments[1] ?? '') : '';
    const onAccountSwitchScreen = ACCOUNT_SWITCH_SCREENS.has(authScreen);

    // Invited users mid first-signin → set-password hold a session on purpose.
    if (mustSetPassword) return;

    // Allow opening an invite link / switching accounts while another session
    // is still active — do NOT bounce them to the previous user's home.
    if (onAccountSwitchScreen) return;

    if (!session && !inAuthGroup) {
      router.replace(routes.SIGN_IN);
      return;
    }

    if (session && inAuthGroup) {
      // Wait until role is known so we never land investors on LM screens.
      if (!role) return;
      router.replace(getDefaultTabRoute(role));
    }
  }, [session, isInitialized, segments, router, role, mustSetPassword]);

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
