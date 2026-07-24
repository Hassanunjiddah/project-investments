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
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import { supabase } from '@/src/services/supabase';
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
      pushToast({
        type: 'success',
        message: 'Password set — welcome to Prism Capital.',
      });
      const role = useAuthStore.getState().role;
      if (params.projectId) {
        router.replace(`/(tabs)/projects/${params.projectId}`);
      } else if (role === 'INVESTOR' || role === null) {
        const uid = useAuthStore.getState().session?.user.id;
        if (uid) {
          const { data } = await supabase
            .from('invites')
            .select('project_id, status')
            .eq('investor_id', uid)
            .in('status', ['ACCEPTED', 'COMMITTED', 'PROOF_SUBMITTED'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data?.project_id) {
            router.replace(`/(tabs)/projects/${data.project_id}`);
            return;
          }
        }
        router.replace('/(tabs)/invitations');
      } else {
        router.replace(getDefaultTabRoute(role));
      }
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
