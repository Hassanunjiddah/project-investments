import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

import { AuthShell } from '@/src/components/auth/AuthShell';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthErrorBanner } from '@/src/components/auth/AuthErrorBanner';
import { SegmentedCodeInput } from '@/src/components/auth/SegmentedCodeInput';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';

import { redeemInviteCode, verifyMagicToken } from '@/src/services/inviteAuth.services';
import { fetchProfile } from '@/src/services/profile.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { mapAuthError, type MappedError } from '@/src/utils/authErrors';

export default function FirstSigninScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<MappedError | null>(null);

  useEffect(() => {
    if (params.email && !email) setEmail(String(params.email));
    if (params.code && !code) setCode(String(params.code).toUpperCase().slice(0, 8));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.email, params.code]);

  const isReady = email.trim().length > 0 && code.length === 8;

  const handleSubmit = async () => {
    setErr(null);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedEmail || !trimmedCode || trimmedCode.length !== 8) {
      setErr({
        title: 'Fill in both fields',
        hint: 'Enter your email and the 8-character code from your invitation.',
        testTag: 'auth-error-incomplete',
      });
      return;
    }
    setLoading(true);
    try {
      const redeem = await redeemInviteCode({ email: trimmedEmail, code: trimmedCode });
      if (!redeem.passwordAlreadySet) {
        useAuthStore.getState().setMustSetPassword(true);
      }
      await verifyMagicToken(redeem.email, redeem.tokenHash);

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
      } else if (redeem.projectId) {
        router.replace(`/set-password?projectId=${encodeURIComponent(redeem.projectId)}` as never);
      } else {
        // Staff invitation (Line Manager) — no project attached; set-password
        // routes by role afterwards.
        router.replace('/set-password' as never);
      }
    } catch (e) {
      useAuthStore.getState().setMustSetPassword(false);
      const mapped = mapAuthError(e, 'first-signin');
      setErr(mapped);
      pushToast({ type: 'error', message: mapped.title });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell testID="first-signin-screen">
      <Head>
        <title>First-time sign-in · Prism Capital</title>
      </Head>

      <AuthHeader
        eyebrow="Welcome"
        title="First time here?"
        subtitle="Enter the email you were invited on and the 8-character code from your invitation."
      />

      <View style={styles.form}>
        <AuthErrorBanner err={err} />

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          data-testid="first-signin-email-input"
        />

        <View style={styles.codeBlock}>
          <Text style={[styles.codeLabel, { color: palette.textSecondary }]}>
            Invitation code
          </Text>
          <SegmentedCodeInput
            value={code}
            onChange={setCode}
            length={8}
            data-testid="first-signin-code-input"
          />
          <Text style={[styles.codeHint, { color: palette.textSecondary }]}>
            Case-insensitive. Paste the whole code — we'll spread it across boxes.
          </Text>
        </View>

        <Button
          title={loading ? 'Verifying…' : 'Continue'}
          onPress={handleSubmit}
          loading={loading}
          disabled={!isReady && !loading}
          data-testid="first-signin-submit-btn"
        />

        <Pressable onPress={() => router.replace('/sign-in')} style={styles.linkWrap}>
          <Text style={[styles.link, { color: palette.primary }]}>
            ← Back to sign in
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  codeBlock: { gap: 8 },
  codeLabel: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  codeHint: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  linkWrap: { alignSelf: 'center', paddingVertical: spacing.xs },
  link: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
});
