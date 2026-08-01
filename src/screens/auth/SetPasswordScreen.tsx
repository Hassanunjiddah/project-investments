import { useState } from 'react';
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

import { setPasswordAndMark } from '@/src/services/inviteAuth.services';
import { fetchProfile } from '@/src/services/profile.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute, investorProjectHref } from '@/src/helpers/routing';
import { isInvestor } from '@/src/helpers/guards';
import { mapAuthError, type MappedError } from '@/src/utils/authErrors';

export default function SetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<MappedError | null>(null);

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
      useAuthStore.getState().setMustSetPassword(false);

      // Re-fetch profile so routing never uses a stale/null role from the
      // previous account that was signed in on this device.
      const uid = useAuthStore.getState().session?.user.id;
      if (uid) {
        try {
          const profile = await fetchProfile(uid);
          useAuthStore.getState().setRole(profile.role);
          useAuthStore.getState().updateUser(profile);
        } catch {
          // AuthGuard / HomeScreen wait for role if this fails.
        }
      }

      pushToast({
        type: 'success',
        message: 'Password set — welcome to Prism Capital.',
      });

      const role = useAuthStore.getState().role;

      // Investors must land on the portfolio stack (visible in their tabs).
      // Never send them to /(tabs)/projects or /(tabs)/invitations — those
      // screens have href:null for investors and trap the back stack.
      if (isInvestor(role) || role === null) {
        if (params.projectId) {
          router.replace(investorProjectHref(String(params.projectId)));
          return;
        }
        router.replace(getDefaultTabRoute(role));
        return;
      }

      if (params.projectId && role === 'LINE_MANAGER') {
        router.replace(`/(tabs)/projects/${params.projectId}` as never);
        return;
      }

      router.replace(getDefaultTabRoute(role));
    } catch (e) {
      const mapped = mapAuthError(e, 'set-password');
      setErr(mapped);
      pushToast({ type: 'error', message: mapped.title });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell testID="set-password-screen">
      <Head>
        <title>Set your password · Prism Capital</title>
      </Head>

      <AuthHeader
        eyebrow="Almost there"
        title="Create your password"
        subtitle="You'll use this to sign in from now on."
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
