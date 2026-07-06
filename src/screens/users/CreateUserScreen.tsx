import { useState } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Clipboard from 'expo-clipboard';
import { createUserSchema, type CreateUserFormValues } from '@/src/schemas/user.schema';
import { useCreateUser } from '@/src/hooks/profile/useCreateUser';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { canCreateUsers } from '@/src/helpers/guards';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { FormInput } from '@/src/components/form/FormInput';
import { FormSelect } from '@/src/components/form/FormSelect';
import { FormSubmitButton } from '@/src/components/form/FormSubmitButton';
import type { CreateUserEdgeResult } from '@/src/services/edgeFunctions.services';
import { ROLE_LABELS } from '@/src/constants/roles';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

const ROLE_OPTIONS = [
  { label: ROLE_LABELS.LINE_MANAGER, value: 'LINE_MANAGER' },
  { label: ROLE_LABELS.INVESTOR, value: 'INVESTOR' },
];

export default function CreateUserScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const { data: profile } = useFetchProfile();
  const createUser = useCreateUser();
  const [result, setResult] = useState<CreateUserEdgeResult | null>(null);

  const methods = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema) as Resolver<CreateUserFormValues>,
    defaultValues: { email: '', fullName: '', role: 'INVESTOR' },
  });

  if (!canCreateUsers(profile?.role ?? null)) {
    return (
      <EmptyState
        title="Access denied"
        message="Only admins can create users."
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
      pushToast({ type: 'success', message: 'User created successfully.' });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create user',
      });
    }
  });

  const copyPassword = async () => {
    if (!result?.password) return;
    await Clipboard.setStringAsync(result.password);
    pushToast({ type: 'success', message: 'Password copied to clipboard.' });
  };

  return (
    <ScreenLayout>
      <KeyboardAvoidingScreen>
        <Text style={[styles.heading, { color: palette.text }]}>Create user</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Creates a sign-in account. Share the generated password with the user — it is shown once.
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
            <FormSelect name="role" label="Role" options={ROLE_OPTIONS} />
            <FormSubmitButton title="Create user" onPress={onSubmit} />
          </View>
        </FormProvider>

        {result ? (
          <Card style={styles.resultCard}>
            <Text style={[styles.resultTitle, { color: palette.text }]}>User created</Text>
            <Text style={[styles.resultRow, { color: palette.textSecondary }]}>
              {result.fullName} · {result.email}
            </Text>
            <Badge label={ROLE_LABELS[result.role]} variant="success" />
            <Text style={[styles.passwordLabel, { color: palette.text }]}>Temporary password</Text>
            <Text style={[styles.password, { color: palette.primary }]}>{result.password}</Text>
            <View style={styles.resultActions}>
              <Button title="Copy password" variant="secondary" onPress={copyPassword} />
              <Button
                title="Create another"
                onPress={() => setResult(null)}
                style={styles.resultAction}
              />
            </View>
          </Card>
        ) : null}

        <Button title="Back to users" variant="secondary" onPress={() => router.back()} />
      </KeyboardAvoidingScreen>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
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
  passwordLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: spacing.sm,
  },
  password: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  resultActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  resultAction: {
    marginTop: spacing.xs,
  },
});
