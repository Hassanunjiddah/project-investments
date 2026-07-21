import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { redeemInviteCode, verifyMagicToken } from '@/src/services/inviteAuth.services';
import { fetchProfile } from '@/src/services/profile.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';

export default function FirstSigninScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.email && !email) setEmail(String(params.email));
    if (params.code && !code) setCode(String(params.code).toUpperCase());
    // Only re-run if URL params change on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.email, params.code]);

  const handleSubmit = async () => {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedEmail || !trimmedCode || trimmedCode.length !== 8) {
      setError('Enter your email and 8-character code.');
      return;
    }
    setLoading(true);
    try {
      const redeem = await redeemInviteCode({ email: trimmedEmail, code: trimmedCode });
      // Pre-set the flag BEFORE verifyMagicToken so the AuthGuard is inert
      // during the session-creation re-render that follows.
      if (!redeem.passwordAlreadySet) {
        useAuthStore.getState().setMustSetPassword(true);
      }
      await verifyMagicToken(redeem.email, redeem.tokenHash);

      // Refresh profile + role in local store
      const { data: sessionData } = await import('@/src/services/supabase').then((m) =>
        m.supabase.auth.getSession(),
      );
      const userId = sessionData.session?.user?.id;
      if (userId) {
        try {
          const profile = await fetchProfile(userId);
          useAuthStore.getState().setRole(profile.role);
        } catch {
          // ignore
        }
      }

      if (redeem.passwordAlreadySet) {
        pushToast({ type: 'info', message: 'Welcome back — signed in.' });
        router.replace(getDefaultTabRoute(useAuthStore.getState().role));
      } else {
        router.replace(`/set-password?projectId=${encodeURIComponent(redeem.projectId)}` as never);
      }
    } catch (e) {
      // Clear the flag so the guard behaves normally again if the flow aborts.
      useAuthStore.getState().setMustSetPassword(false);
      const msg = e instanceof Error ? e.message : 'Failed to sign in';
      setError(msg);
      pushToast({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <Head>
        <title>First-time sign-in · RibhShare</title>
      </Head>
      <KeyboardAvoidingScreen contentContainerStyle={{ padding: 10 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Welcome to RibhShare</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Enter your email and the 8-character code from your invitation email to review the project.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            data-testid="first-signin-email-input"
          />
          <TextInput
            label="8-character code"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
            autoCapitalize="characters"
            maxLength={8}
            data-testid="first-signin-code-input"
          />
          {error ? <Text style={[styles.err, { color: palette.warning }]}>{error}</Text> : null}
          <Button
            title="Continue"
            onPress={handleSubmit}
            loading={loading}
            data-testid="first-signin-submit-btn"
          />

          <Pressable onPress={() => router.replace('/sign-in')} style={styles.linkWrap}>
            <Text style={[styles.link, { color: palette.primary }]}>
              Already have a password? Sign in
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingScreen>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xl,
    marginTop: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    lineHeight: 22,
  },
  form: { gap: spacing.md },
  err: { fontSize: typography.sizes.xs },
  linkWrap: { alignSelf: 'center', marginTop: spacing.sm },
  link: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
});
