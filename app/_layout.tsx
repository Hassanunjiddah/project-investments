import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { AppProviders } from '@/src/providers/AppProviders';
import { useAuthStore } from '@/src/store/useAuthStore';
import { routes } from '@/src/constants/routes';
import { getDefaultTabRoute } from '@/src/helpers/routing';

SplashScreen.preventAutoHideAsync();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isInitialized, role } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;

    SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    // Investors coming from an invite are momentarily inside the (auth) group
    // WITH a session (verifyOtp succeeded) so they can reach /set-password.
    // Do NOT bounce them to a tab route from this screen — otherwise the guard
    // races FirstSigninScreen's router.replace('/set-password?...') and wins.
    const allowedAuthedAuthRoute = segments[1] === 'set-password';

    if (!session && !inAuthGroup) {
      router.replace(routes.SIGN_IN);
    } else if (session && inAuthGroup && !allowedAuthedAuthRoute) {
      router.replace(getDefaultTabRoute(role));
    }
  }, [session, isInitialized, segments, router, role]);

  if (!isInitialized) {
    return null;
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
