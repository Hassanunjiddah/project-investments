import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { setPasswordAndMark } from '@/src/services/inviteAuth.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';

export default function SetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await setPasswordAndMark(password);
      pushToast({ type: 'success', message: 'Password set — welcome to RibhShare.' });
      const role = useAuthStore.getState().role;
      // If we have a projectId (from redeem-invite-code), deep-link straight into it.
      if (params.projectId) {
        router.replace(`/(tabs)/projects/${params.projectId}`);
      } else {
        router.replace(getDefaultTabRoute(role));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to set password';
      setError(msg);
      pushToast({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenLayout>
      <Head>
        <title>Set your password · RibhShare</title>
      </Head>
      <KeyboardAvoidingScreen contentContainerStyle={{ padding: 10 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>Create your password</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            You'll use this password for future sign-ins. Minimum 8 characters.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            data-testid="set-password-input"
          />
          <TextInput
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            data-testid="set-password-confirm-input"
          />
          {error ? <Text style={[styles.err, { color: palette.warning }]}>{error}</Text> : null}
          <Button
            title="Save & continue"
            onPress={submit}
            loading={loading}
            data-testid="set-password-submit-btn"
          />
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
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold },
  subtitle: { fontSize: typography.sizes.md, lineHeight: 22 },
  form: { gap: spacing.md },
  err: { fontSize: typography.sizes.xs },
});
