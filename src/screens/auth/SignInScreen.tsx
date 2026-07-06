import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, View, StyleSheet, useColorScheme } from 'react-native';
import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { signInSchema, type SignInFormValues } from '@/src/schemas/auth.schema';
import { useSignIn } from '@/src/hooks/auth/useSignIn';
import { fetchProfile } from '@/src/services/profile.services';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useUiStore } from '@/src/store/useUiStore';
import { FormInput } from '@/src/components/form/FormInput';
import { FormSubmitButton } from '@/src/components/form/FormSubmitButton';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { getDefaultTabRoute } from '@/src/helpers/routing';

export default function SignInScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const signIn = useSignIn();

  const methods = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = methods.handleSubmit(async (values) => {
    try {
      const session = await signIn.mutateAsync(values);
      if (session.user) {
        try {
          const profile = await fetchProfile(session.user.id);
          useAuthStore.getState().setRole(profile.role);
          router.replace(getDefaultTabRoute(profile.role));
          return;
        } catch {
          // Profile fetch failed; fall through to default route
        }
      }
      router.replace(getDefaultTabRoute(useAuthStore.getState().role));
    } catch (error) {
      pushToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Sign in failed',
      });
    }
  });

  return (
    <ScreenLayout>
      <Head>
        <title>Sign In · RibhShare</title>
        <meta
          name="description"
          content="Sign in to RibhShare — Shariah-compliant project investments."
        />
      </Head>
      <KeyboardAvoidingScreen contentContainerStyle={{ padding: 10 }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]}>RibhShare</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Shariah-compliant project investments
          </Text>
        </View>

        <FormProvider {...methods}>
          <View style={styles.form}>
            <FormInput
              name="email"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormInput name="password" label="Password" secureTextEntry autoCapitalize="none" />
            <FormSubmitButton title="Sign In" onPress={onSubmit} />
          </View>
        </FormProvider>
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
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
});
