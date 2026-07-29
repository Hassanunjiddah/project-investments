import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import { createUserSchema, type CreateUserFormValues } from '@/src/schemas/user.schema';
import { useCreateUser } from '@/src/hooks/profile/useCreateUser';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { canCreateUsers } from '@/src/helpers/guards';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { FormInput } from '@/src/components/form/FormInput';
import { FormSubmitButton } from '@/src/components/form/FormSubmitButton';
import type { CreateUserEdgeResult } from '@/src/services/edgeFunctions.services';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { FORM_MAX_WIDTH } from '@/src/constants/layout';

export default function CreateUserScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const { data: profile } = useFetchProfile();
  const createUser = useCreateUser();
  const [result, setResult] = useState<CreateUserEdgeResult | null>(null);

  const methods = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema) as Resolver<CreateUserFormValues>,
    defaultValues: { email: '', fullName: '' },
  });

  if (!canCreateUsers(profile?.role ?? null)) {
    return (
      <EmptyState
        title="Access denied"
        message="Only the CEO can create line managers."
        actionLabel="Go back"
        onAction={() => router.back()}
      />
    );
  }

  const onSubmit = methods.handleSubmit(async (values) => {
    try {
      const created = await createUser.mutateAsync(values);
      setResult(created);
      methods.reset();
      pushToast({
        type: created.emailSent ? 'success' : 'info',
        message: created.emailSent
          ? `Invitation sent to ${created.email}.`
          : 'Account created, but the email failed — share the code manually.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create line manager',
      });
    }
  });

  const copyCode = async () => {
    if (!result?.signinCode) return;
    await Clipboard.setStringAsync(result.signinCode);
    pushToast({ type: 'success', message: 'Sign-in code copied to clipboard.' });
  };

  return (
    <ScreenLayout>
      <KeyboardAvoidingScreen>
        <View style={styles.column}>
          <Text style={[styles.heading, { color: palette.text }]}>Create line manager</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            They'll receive an email with a one-time sign-in code, then set their own password on
            first sign-in. Line managers can create projects and invite investors.
          </Text>

          <FormProvider {...methods}>
            <View style={styles.form}>
              <FormInput name="fullName" label="Full name" autoCapitalize="words" />
              <FormInput
                name="email"
                label="Email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <FormSubmitButton title="Send invitation" onPress={onSubmit} />
            </View>
          </FormProvider>

          {result ? (
            <Card style={styles.resultCard}>
              <Text style={[styles.resultTitle, { color: palette.text }]}>
                {result.emailSent ? 'Invitation sent' : 'Account created — email failed'}
              </Text>
              <Text style={[styles.resultRow, { color: palette.textSecondary }]}>
                {result.fullName} · {result.email}
              </Text>
              <Badge label="Line Manager" variant="success" />
              <Text style={[styles.codeLabel, { color: palette.text }]}>
                One-time sign-in code
              </Text>
              <Text style={[styles.code, { color: palette.primary }]}>{result.signinCode}</Text>
              <Text style={[styles.codeHint, { color: palette.textSecondary }]}>
                {result.emailSent
                  ? 'Also emailed to them — keep this as a backup. Valid for 14 days.'
                  : 'The email could not be sent — share this code with them directly. Valid for 14 days.'}
              </Text>
              <View style={styles.resultActions}>
                <Button title="Copy code" variant="secondary" onPress={copyCode} />
                <Button
                  title="Create another"
                  onPress={() => setResult(null)}
                  style={styles.resultAction}
                />
              </View>
            </Card>
          ) : null}

          <Button title="Back to users" variant="secondary" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingScreen>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  // Keep the single-column form readable on wide desktop viewports.
  column: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
  },
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  resultCard: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  resultTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  resultRow: {
    fontSize: typography.sizes.sm,
  },
  codeLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: spacing.sm,
  },
  code: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    fontFamily: 'monospace',
    letterSpacing: 4,
  },
  codeHint: {
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  resultActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  resultAction: {
    marginTop: spacing.xs,
  },
});
