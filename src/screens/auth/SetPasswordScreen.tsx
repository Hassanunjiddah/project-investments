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
import { supabase } from '@/src/services/supabase';

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
      // Password is set — release the AuthGuard hold.
      useAuthStore.getState().setMustSetPassword(false);
      pushToast({ type: 'success', message: 'Password set — welcome to RibhShare.' });
      const role = useAuthStore.getState().role;
      // Deep-link priority:
      //  1. explicit ?projectId= param (came in via redeem-invite-code)
      //  2. investor with any invite awaiting their review → /invitations
      //     (this fixes the old "lands on /home" bug where investors couldn't
      //     find the project they were invited to)
      //  3. fallback to role's default tab
      if (params.projectId) {
        router.replace(`/(tabs)/projects/${params.projectId}`);
      } else if (role === 'INVESTOR' || role === null) {
        // If role is null we're likely still a fresh investor sign-in. Check
        // for a pending/committed invite and jump straight to that project.
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
