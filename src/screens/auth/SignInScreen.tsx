import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput as RNTextInput } from 'react-native';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import Head from 'expo-router/head';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

import { signInSchema, type SignInFormValues } from '@/src/schemas/auth.schema';
import { useSignIn } from '@/src/hooks/auth/useSignIn';
import { fetchProfile } from '@/src/services/profile.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';

import { AuthShell } from '@/src/components/auth/AuthShell';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthErrorBanner } from '@/src/components/auth/AuthErrorBanner';
import { PasswordField } from '@/src/components/auth/PasswordField';
import { Checkbox } from '@/src/components/auth/Checkbox';
import { FormInput } from '@/src/components/form/FormInput';
import { Button } from '@/src/components/ui/Button';
import { mapAuthError, type MappedError } from '@/src/utils/authErrors';
import {
  checkSignInCooldown,
  recordSignInFailure,
  recordSignInSuccess,
} from '@/src/utils/signInCooldown';

const KEEP_KEY = 'prism.keepSignedIn';

function loadKeepFlag(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  const v = window.localStorage.getItem(KEEP_KEY);
  return v === null ? true : v === 'true';
}

function saveKeepFlag(v: boolean) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(KEEP_KEY, String(v));
}

export default function SignInScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const signIn = useSignIn();
  const [err, setErr] = useState<MappedError | null>(null);
  const [keepSignedIn, setKeepSignedIn] = useState<boolean>(loadKeepFlag());

  const methods = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const submitting = signIn.isPending;

  const onSubmit = methods.handleSubmit(async (values) => {
    setErr(null);

    // Client-side cooldown check
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

    try {
      saveKeepFlag(keepSignedIn);
      const session = await signIn.mutateAsync(values);
      recordSignInSuccess();
      if (session.user) {
        try {
          const profile = await fetchProfile(session.user.id);
          useAuthStore.getState().setRole(profile.role);
          router.replace(getDefaultTabRoute(profile.role));
          return;
        } catch {
          // fall through
        }
      }
      router.replace(getDefaultTabRoute(useAuthStore.getState().role));
    } catch (error) {
      const state = recordSignInFailure();
      const mapped = mapAuthError(error, 'signin');
      // If this failure tripped the cooldown, override the message.
      if (state.cooling) {
        setErr({
          title: 'Too many attempts',
          hint: 'For your security, sign-in is paused for 15 minutes.',
          testTag: 'auth-error-cooldown',
        });
      } else if (state.attemptsRemaining > 0 && state.attemptsRemaining <= 2) {
        setErr({
          ...mapped,
          hint: `${mapped.hint ?? ''} ${state.attemptsRemaining} attempt${state.attemptsRemaining === 1 ? '' : 's'} remaining before a 15-minute cooldown.`.trim(),
        });
      } else {
        setErr(mapped);
      }
      pushToast({ type: 'error', message: mapped.title });
    }
  });

  return (
    <AuthShell
      testID="signin-screen"
      footer={
        <Text style={[styles.legal, { color: palette.textSecondary }]}>
          Prism Capital · Institutional private placements
        </Text>
      }
    >
      <Head>
        <title>Sign In · Prism Capital</title>
        <meta
          name="description"
          content="Sign in to Prism Capital — institutional Shariah-compliant private placements."
        />
      </Head>

      <AuthHeader
        eyebrow="Welcome back"
        title="Sign in"
        subtitle="Access your projects, statements, and approvals."
      />

      <FormProvider {...methods}>
        <View style={styles.form}>
          <AuthErrorBanner err={err} />

          <FormInput
            name="email"
            label="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            data-testid="signin-email-input"
          />

          <PasswordField
            value={methods.watch('password') ?? ''}
            onChangeText={(t) => methods.setValue('password', t, { shouldValidate: false })}
            label="Password"
            autoComplete="current-password"
            placeholder="Your password"
            data-testid="signin-password-input"
            error={methods.formState.errors.password?.message as string | undefined}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          <Checkbox
            checked={keepSignedIn}
            onChange={setKeepSignedIn}
            label="Keep me signed in on this device"
            data-testid="signin-keep-checkbox"
          />

          <Button
            title={submitting ? 'Signing in…' : 'Sign in'}
            onPress={onSubmit}
            loading={submitting}
            data-testid="signin-submit-btn"
          />

          <Pressable
            onPress={() => router.push('/first-signin' as never)}
            style={styles.linkWrap}
            data-testid="link-first-signin"
          >
            <Text style={[styles.link, { color: palette.primary }]}>
              First time here? Sign in with your invitation code →
            </Text>
          </Pressable>
        </View>
      </FormProvider>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  linkWrap: { alignSelf: 'center', paddingVertical: spacing.xs },
  link: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '500',
  },
  legal: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.4,
  },
});
