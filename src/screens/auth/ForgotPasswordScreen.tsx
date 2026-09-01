import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '@/src/schemas/auth.schema';
import { requestPasswordReset } from '@/src/services/auth.services';
import { AuthShell } from '@/src/components/auth/AuthShell';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthErrorBanner } from '@/src/components/auth/AuthErrorBanner';
import { FormInput } from '@/src/components/form/FormInput';
import { Button } from '@/src/components/ui/Button';
import { mapAuthError, type MappedError } from '@/src/utils/authErrors';
import {
  checkSignInCooldown,
  recordSignInFailure,
  recordSignInSuccess,
} from '@/src/utils/signInCooldown';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const [err, setErr] = useState<MappedError | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const methods = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const onSubmit = methods.handleSubmit(async (values) => {
    setErr(null);
    const cooldown = checkSignInCooldown();
    if (cooldown.cooling) {
      const mins = Math.ceil(cooldown.secondsLeft / 60);
      setErr({
        title: 'Too many attempts',
        hint: `Please wait about ${mins} minute${mins === 1 ? '' : 's'} before trying again.`,
        testTag: 'auth-error-cooldown',
      });
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(values.email);
      recordSignInSuccess();
      setSent(true);
      pushToast({
        type: 'success',
        message: 'If that email has an account, we sent a reset link.',
      });
    } catch (error) {
      recordSignInFailure();
      const mapped = mapAuthError(error, 'forgot-password');
      setErr(mapped);
      pushToast({ type: 'error', message: mapped.title });
    } finally {
      setLoading(false);
    }
  });

  return (
    <AuthShell testID="forgot-password-screen">
      <Head>
        <title>Forgot password · Prism Capital</title>
      </Head>

      <AuthHeader
        eyebrow="Account recovery"
        title="Forgot password"
        subtitle={
          sent
            ? 'Check your inbox for a reset link. It may take a minute to arrive.'
            : 'Enter the email on your Prism Capital account. We’ll send a reset link if it exists.'
        }
      />

      {sent ? (
        <View style={styles.form}>
          <Text style={[styles.sentBody, { color: palette.textSecondary }]}>
            If that email has an account, we sent a link. Open it on this device to choose a new
            password.
          </Text>
          <Button
            title="Back to sign in"
            onPress={() => router.replace('/(auth)/sign-in' as never)}
            size="lg"
            data-testid="forgot-back-signin-btn"
          />
          <Pressable
            onPress={() => {
              setSent(false);
              methods.reset({ email: '' });
            }}
            style={styles.linkRow}
            accessibilityRole="button"
          >
            <Text style={[styles.linkText, { color: palette.primary }]}>
              Try a different email
            </Text>
          </Pressable>
        </View>
      ) : (
        <FormProvider {...methods}>
          <View style={styles.form}>
            <AuthErrorBanner err={err} />
            <FormInput
              name="email"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              data-testid="forgot-email-input"
            />
            <Button
              title={loading ? 'Sending…' : 'Send reset link'}
              onPress={onSubmit}
              loading={loading}
              size="lg"
              data-testid="forgot-submit-btn"
            />
            <Pressable
              onPress={() => router.replace('/(auth)/sign-in' as never)}
              style={styles.linkRow}
              accessibilityRole="link"
            >
              <Text style={[styles.linkText, { color: palette.primary }]}>← Back to sign in</Text>
            </Pressable>
          </View>
        </FormProvider>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  sentBody: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    lineHeight: 22,
  },
  linkRow: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
});
