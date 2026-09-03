import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

import { AuthShell } from '@/src/components/auth/AuthShell';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthErrorBanner } from '@/src/components/auth/AuthErrorBanner';
import { PasswordField } from '@/src/components/auth/PasswordField';
import {
  PasswordStrength,
  isPasswordStrong,
} from '@/src/components/auth/PasswordStrength';
import { Button } from '@/src/components/ui/Button';
import { BootSplash } from '@/src/components/ui/BootSplash';

import {
  exchangeRecoveryCode,
  setSessionFromRecoveryTokens,
  updatePassword,
} from '@/src/services/auth.services';
import { fetchProfile } from '@/src/services/profile.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { setGateUnlocked } from '@/src/constants/session';
import { mapAuthError, type MappedError } from '@/src/utils/authErrors';

function readHashParams(): Record<string, string> {
  if (typeof window === 'undefined' || !window.location?.hash) return {};
  const raw = window.location.hash.replace(/^#/, '');
  const out: Record<string, string> = {};
  for (const part of raw.split('&')) {
    const [k, v] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '');
  }
  return out;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  const session = useAuthStore((s) => s.session);
  const mustResetPassword = useAuthStore((s) => s.mustResetPassword);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false);
  const [exchanging, setExchanging] = useState(true);
  const [err, setErr] = useState<MappedError | null>(null);

  // Exchange recovery link → session, then gate with mustResetPassword.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setExchanging(true);
      setErr(null);
      try {
        const code = typeof params.code === 'string' ? params.code : undefined;
        const hash = readHashParams();
        const accessToken = hash.access_token;
        const refreshToken = hash.refresh_token;
        const type = hash.type;

        if (code) {
          const next = await exchangeRecoveryCode(code);
          if (cancelled) return;
          useAuthStore.getState().setMustResetPassword(true);
          useAuthStore.getState().setSession(next);
          const profile = await fetchProfile(next.user.id);
          if (!cancelled) useAuthStore.getState().applyProfile(profile);
        } else if (accessToken && refreshToken && (type === 'recovery' || !type)) {
          const next = await setSessionFromRecoveryTokens({
            accessToken,
            refreshToken,
          });
          if (cancelled) return;
          useAuthStore.getState().setMustResetPassword(true);
          useAuthStore.getState().setSession(next);
          const profile = await fetchProfile(next.user.id);
          if (!cancelled) useAuthStore.getState().applyProfile(profile);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        } else if (session && mustResetPassword) {
          // Already in recovery after a remount.
        } else if (!session) {
          if (!cancelled) {
            setErr({
              title: 'Reset link missing or expired',
              hint: 'Request a new password reset email and open the link again.',
              testTag: 'auth-error-reset-expired',
            });
          }
        }
      } catch (e) {
        if (!cancelled) {
          const mapped = mapAuthError(e, 'reset-password');
          setErr(mapped);
        }
      } finally {
        if (!cancelled) setExchanging(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
    // Intentionally once on mount / when code param appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  const strong = isPasswordStrong(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = strong && matches && !loading && !!session && mustResetPassword;

  const submit = async () => {
    setErr(null);
    if (!strong) {
      setErr({
        title: 'Password too weak',
        hint: 'All three requirements must be met.',
        testTag: 'auth-error-weak-password',
      });
      return;
    }
    if (!matches) {
      setErr({
        title: "Passwords don't match",
        hint: 'Re-enter the same password in both fields.',
        testTag: 'auth-error-mismatch',
      });
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      useAuthStore.getState().setMustResetPassword(false);
      setGateUnlocked(true);

      const uid = useAuthStore.getState().session?.user.id;
      if (uid) {
        const profile = await fetchProfile(uid);
        useAuthStore.getState().applyProfile(profile);
      }

      pushToast({ type: 'success', message: 'Password updated. You’re signed in.' });
      setEntering(true);
      const role = useAuthStore.getState().role;
      router.replace(role ? getDefaultTabRoute(role) : ('/(auth)/sign-in' as never));
    } catch (e) {
      setEntering(false);
      const mapped = mapAuthError(e, 'reset-password');
      setErr(mapped);
      pushToast({ type: 'error', message: mapped.title });
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialized || exchanging || entering) {
    return (
      <BootSplash
        message={entering ? 'Opening your workspace…' : 'Validating reset link…'}
      />
    );
  }

  if (!session || !mustResetPassword) {
    return (
      <AuthShell testID="reset-password-screen">
        <Head>
          <title>Reset password · Prism Capital</title>
        </Head>
        <AuthHeader
          eyebrow="Account recovery"
          title="Link not valid"
          subtitle="Request a new reset email from the sign-in screen."
        />
        <View style={styles.form}>
          <AuthErrorBanner err={err} />
          <Button
            title="Forgot password"
            onPress={() => router.replace('/(auth)/forgot-password' as never)}
            size="lg"
          />
          <Button
            title="Back to sign in"
            variant="outline"
            onPress={() => router.replace('/(auth)/sign-in' as never)}
          />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell testID="reset-password-screen">
      <Head>
        <title>Choose a new password · Prism Capital</title>
      </Head>

      <AuthHeader
        eyebrow="Account recovery"
        title="Choose a new password"
        subtitle="You’re signed in via the reset link. Pick a strong password to continue."
      />

      <View style={styles.form}>
        <AuthErrorBanner err={err} />

        <PasswordField
          value={password}
          onChangeText={setPassword}
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          data-testid="reset-password-input"
        />
        <PasswordStrength password={password} data-testid="reset-password-strength" />

        <PasswordField
          value={confirm}
          onChangeText={setConfirm}
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          data-testid="reset-password-confirm-input"
          error={
            confirm.length > 0 && !matches
              ? "Doesn't match the password above"
              : undefined
          }
        />

        <Button
          title={loading ? 'Saving…' : 'Save new password'}
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
          data-testid="reset-password-submit-btn"
        />

        <Text style={[styles.footnote, { color: palette.textSecondary }]}>
          After saving you’ll land in your usual Prism Capital workspace.
        </Text>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  footnote: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
