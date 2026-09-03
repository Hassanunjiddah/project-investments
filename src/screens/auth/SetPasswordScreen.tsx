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

import { setPasswordAndMark } from '@/src/services/inviteAuth.services';
import { fetchProfile } from '@/src/services/profile.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute, investorProjectHref } from '@/src/helpers/routing';
import { setGateUnlocked } from '@/src/constants/session';
import { isInvestor } from '@/src/helpers/guards';
import { mapAuthError, type MappedError } from '@/src/utils/authErrors';

export default function SetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const session = useAuthStore((s) => s.session);
  const mustSetPassword = useAuthStore((s) => s.mustSetPassword);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [entering, setEntering] = useState(false);
  const [err, setErr] = useState<MappedError | null>(null);

  const user = useAuthStore((s) => s.user);
  const profileNeedsPassword = !!user && !user.passwordSetAt;
  const showPasswordForm = mustSetPassword || profileNeedsPassword;

  // Invite-only: no session → first-signin. Leave only once password is set.
  useEffect(() => {
    if (!isInitialized || entering) return;
    if (!session) {
      router.replace('/(auth)/first-signin' as never);
      return;
    }
    if (!mustSetPassword && user?.passwordSetAt) {
      const role = useAuthStore.getState().role;
      router.replace(role ? getDefaultTabRoute(role) : ('/(auth)/sign-in' as never));
    }
  }, [isInitialized, session, mustSetPassword, user?.passwordSetAt, entering, router]);

  const strong = isPasswordStrong(password);
  const matches = password.length > 0 && password === confirm;
  const canSubmit = strong && matches && !loading;

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
      await setPasswordAndMark(password);

      const uid = useAuthStore.getState().session?.user.id;
      if (!uid) {
        throw new Error('Your session expired. Open the invite link again.');
      }

      const profile = await fetchProfile(uid);
      // password_set_at must be present after mark — refuse to enter the app otherwise.
      if (!profile.passwordSetAt) {
        throw new Error(
          'Could not confirm your password was saved. Please try again in a moment.',
        );
      }
      useAuthStore.getState().applyProfile(profile);
      useAuthStore.getState().setMustSetPassword(false);
      setGateUnlocked(true);

      pushToast({
        type: 'success',
        message: 'Password set — welcome to Prism Capital.',
      });

      const role = useAuthStore.getState().role;
      if (!role) {
        throw new Error('Could not load your account role. Please sign in again.');
      }

      setEntering(true);

      // Investors only — never treat null/unknown as investor (that used to
      // land people on the wrong shell when role hydration raced).
      if (isInvestor(role)) {
        if (params.projectId) {
          router.replace(investorProjectHref(String(params.projectId)));
          return;
        }
        router.replace('/home' as never);
        return;
      }

      if (params.projectId && (role === 'LINE_MANAGER' || role === 'PROJECT_OWNER')) {
        router.replace(`/projects/${params.projectId}` as never);
        return;
      }

      router.replace(getDefaultTabRoute(role));
    } catch (e) {
      setEntering(false);
      const mapped = mapAuthError(e, 'set-password');
      setErr(mapped);
      pushToast({ type: 'error', message: mapped.title });
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialized || !session || !showPasswordForm || entering) {
    return (
      <BootSplash
        message={entering ? 'Opening your workspace…' : 'Checking your invitation…'}
      />
    );
  }

  return (
    <AuthShell testID="set-password-screen">
      <Head>
        <title>Set your password · Prism Capital</title>
      </Head>

      <AuthHeader
        eyebrow="Invitation accepted"
        title="Create your password"
        subtitle="You were invited to participate. Choose a password to sign in from now on — required before your dashboard opens."
      />

      <View style={styles.form}>
        <AuthErrorBanner err={err} />

        <PasswordField
          value={password}
          onChangeText={setPassword}
          label="New password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          data-testid="set-password-input"
        />
        <PasswordStrength password={password} data-testid="set-password-strength" />

        <PasswordField
          value={confirm}
          onChangeText={setConfirm}
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          data-testid="set-password-confirm-input"
          error={
            confirm.length > 0 && !matches
              ? "Doesn't match the password above"
              : undefined
          }
        />

        <Button
          title={loading ? 'Saving…' : 'Save & continue'}
          onPress={submit}
          loading={loading}
          disabled={!canSubmit}
          data-testid="set-password-submit-btn"
        />

        <Text style={[styles.footnote, { color: palette.textSecondary }]}>
          By continuing you agree to Prism Capital's terms and privacy policy.
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
