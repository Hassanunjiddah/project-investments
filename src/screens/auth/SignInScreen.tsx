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

import { signInSchema, type SignInFormValues } from '@/src/schemas/auth.schema';
import { useSignIn } from '@/src/hooks/auth/useSignIn';
import { fetchProfile } from '@/src/services/profile.services';
import { signOut } from '@/src/services/auth.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { getDefaultTabRoute } from '@/src/helpers/routing';
import {
  type AuthPortal,
  portalAllowsRole,
  portalLabel,
} from '@/src/helpers/roleAccess';
import { MAKER_CREDIT } from '@/src/constants/site';

import { AuthShell } from '@/src/components/auth/AuthShell';
import { AuthHeader } from '@/src/components/auth/AuthHeader';
import { AuthErrorBanner } from '@/src/components/auth/AuthErrorBanner';
import { PasswordField } from '@/src/components/auth/PasswordField';
import { Checkbox } from '@/src/components/auth/Checkbox';
import { FormInput } from '@/src/components/form/FormInput';
import { Button } from '@/src/components/ui/Button';
import { BootSplash } from '@/src/components/ui/BootSplash';
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

type Props = {
  /** Investor portal is the public default; staff is CEO / LM / Owner. */
  portal?: AuthPortal;
};

export default function SignInScreen({ portal = 'investor' }: Props) {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const signIn = useSignIn();
  const [err, setErr] = useState<MappedError | null>(null);
  const [keepSignedIn, setKeepSignedIn] = useState<boolean>(loadKeepFlag());
  const [entering, setEntering] = useState(false);

  const methods = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const submitting = signIn.isPending || entering;
  const isInvestorPortal = portal === 'investor';

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

    try {
      saveKeepFlag(keepSignedIn);
      const session = await signIn.mutateAsync(values);
      recordSignInSuccess();
      if (!session.user) {
        throw new Error('No session returned');
      }

      const profile = await fetchProfile(session.user.id);
      useAuthStore.getState().applyProfile(profile);

      // Portal segregation — wrong role never enters the other workspace.
      if (!portalAllowsRole(portal, profile.role)) {
        await signOut().catch(() => undefined);
        useAuthStore.getState().reset();
        const wrong =
          portal === 'investor'
            ? {
                title: 'Staff account detected',
                hint: 'CEO, Line Manager, and Project Owner accounts sign in on the Staff portal.',
                testTag: 'auth-error-wrong-portal',
              }
            : {
                title: 'Investor account detected',
                hint: 'Investors sign in on the Investor portal (or with an invitation code).',
                testTag: 'auth-error-wrong-portal',
              };
        setErr(wrong);
        pushToast({ type: 'error', message: wrong.title });
        return;
      }

      // Password setup is invite-only. Email/password sign-in already proves
      // they have credentials — never bounce them to /set-password.
      if (!profile.passwordSetAt) {
        void import('@/src/services/inviteAuth.services').then(({ markPasswordSet }) =>
          markPasswordSet().catch(() => undefined),
        );
      }

      setEntering(true);
      requestAnimationFrame(() => {
        router.replace(getDefaultTabRoute(profile.role));
      });
    } catch (error) {
      setEntering(false);
      const state = recordSignInFailure();
      const mapped = mapAuthError(error, 'signin');
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

  if (entering) {
    return <BootSplash message="Opening your workspace…" />;
  }

  return (
    <AuthShell
      testID={isInvestorPortal ? 'signin-screen' : 'staff-signin-screen'}
      footer={
        <Text style={[styles.legal, { color: palette.textSecondary }]}>
          Prism Capital · {portalLabel(portal)} portal · {MAKER_CREDIT}
        </Text>
      }
    >
      <Head>
        <title>
          {isInvestorPortal ? 'Investor sign in' : 'Staff sign in'} · Prism Capital
        </title>
        <meta
          name="description"
          content={
            isInvestorPortal
              ? 'Investor sign in to Prism Capital — portfolio, statements, and invitations.'
              : 'Staff sign in to Prism Capital — CEO, Line Manager, and Project Owner workspaces.'
          }
        />
      </Head>

      <AuthHeader
        eyebrow={isInvestorPortal ? 'Investor portal' : 'Staff portal'}
        title="Sign in"
        subtitle={
          isInvestorPortal
            ? 'Access your portfolio, invitations, statements, and messages.'
            : 'CEO, Line Manager, and Project Owner workspace.'
        }
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

          <Pressable
            onPress={() => router.push('/(auth)/forgot-password' as never)}
            style={styles.forgotRow}
            accessibilityRole="link"
            data-testid="link-forgot-password"
          >
            <Text style={[styles.forgotText, { color: palette.primary }]}>Forgot password?</Text>
          </Pressable>

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
            size="lg"
            data-testid="signin-submit-btn"
          />

          {isInvestorPortal ? (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
                <Text style={[styles.dividerText, { color: palette.textSecondary }]}>
                  First time here?
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
              </View>

              <Button
                title="Sign in with your invitation code"
                variant="outline"
                onPress={() => router.push('/first-signin' as never)}
                data-testid="link-first-signin"
              />
            </>
          ) : null}

          <Pressable
            onPress={() =>
              router.replace(
                (isInvestorPortal ? '/staff-sign-in' : '/sign-in') as never,
              )
            }
            style={styles.portalSwitch}
            accessibilityRole="link"
          >
            <Text style={[styles.portalSwitchText, { color: palette.primary }]}>
              {isInvestorPortal
                ? 'Staff / CEO / Line Manager sign in →'
                : '← Investor sign in'}
            </Text>
          </Pressable>
        </View>
      </FormProvider>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.3,
  },
  legal: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.4,
  },
  portalSwitch: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  portalSwitchText: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginTop: -spacing.sm,
    paddingVertical: spacing.xs,
  },
  forgotText: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
});
