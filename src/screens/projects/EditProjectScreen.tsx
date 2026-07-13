import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectFormValues } from '@/src/schemas/project.schema';
import { useFetchProjectById } from '@/src/hooks/projects/useFetchProjectById';
import { useUpdateProject } from '@/src/hooks/projects/useUpdateProject';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { FormInput } from '@/src/components/form/FormInput';
import { Button } from '@/src/components/ui/Button';
import { useUiStore } from '@/src/store/useUiStore';
import { koboToNaira, nairaToKobo } from '@/src/utils/currency';
import { bpsToPercent, percentToBps } from '@/src/types/project.types';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { Ionicons } from '@expo/vector-icons';

export default function EditProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const { data: project, isLoading, isError, error } = useFetchProjectById(id ?? '');
  const updateProject = useUpdateProject(id ?? '');

  const methods = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema) as Resolver<CreateProjectFormValues>,
    defaultValues: {
      name: '',
      sector: '',
      location: '',
      targetAmount: 0,
      durationValue: 12,
      durationUnit: 'MONTHS',
      estimatedRoiPct: 18,
      isPublic: false,
      summary: '',
      fullDetails: '',
      risks: '',
      timeline: '',
      bankName: '',
      accountName: '',
      accountNumber: '',
    },
  });

  useEffect(() => {
    if (!project) return;
    methods.reset({
      name: project.name,
      sector: project.sector,
      location: project.location,
      targetAmount: koboToNaira(project.targetMinor),
      durationValue: project.durationValue,
      durationUnit: project.durationUnit,
      estimatedRoiPct: bpsToPercent(project.estimatedRoiBps),
      isPublic: project.isPublic,
      summary: project.summary,
      fullDetails: project.fullDetails,
      risks: project.risks,
      timeline: project.timeline,
      bankName: project.payAccount?.bankName ?? '',
      accountName: project.payAccount?.accountName ?? '',
      accountNumber: project.payAccount?.accountNumber ?? '',
      profitSplitInvestorBps: project.profitSplitInvestorBps,
      exitNoticeDays: project.exitNoticeDays,
      earlyExitPenaltyBps: project.earlyExitPenaltyBps,
    });
  }, [project, methods]);

  if (isLoading) return <Spinner />;

  if (isError) {
    return <EmptyState title="Could not load project" message={error?.message} />;
  }

  if (!project) return <EmptyState title="Project not found" />;

  const isLocked = project.approvalStatus === 'APPROVED';

  const onSubmit = methods.handleSubmit(async (values) => {
    try {
      await updateProject.mutateAsync({
        name: values.name,
        sector: values.sector,
        location: values.location,
        targetMinor: nairaToKobo(values.targetAmount),
        durationValue: values.durationValue,
        durationUnit: values.durationUnit,
        estimatedRoiBps: percentToBps(values.estimatedRoiPct),
        isPublic: values.isPublic,
        summary: values.summary,
        fullDetails: values.fullDetails,
        risks: values.risks,
        timeline: values.timeline,
        payAccount: {
          bankName: values.bankName,
          accountName: values.accountName,
          accountNumber: values.accountNumber,
        },
        profitSplitInvestorBps: values.profitSplitInvestorBps,
        exitNoticeDays: values.exitNoticeDays,
        earlyExitPenaltyBps: values.earlyExitPenaltyBps,
      });
      pushToast({ type: 'success', message: 'Project updated.' });
      router.back();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Update failed',
      });
    }
  });

  return (
    <ScreenLayout>
      <TouchableOpacity
        onPress={() => router.back()}
        style={{ padding: 10, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      >
        <Ionicons name="chevron-back" size={16} color={palette.text} />
        <Text style={{ color: palette.text }}>Back</Text>
      </TouchableOpacity>
      <KeyboardAvoidingScreen contentContainerStyle={{ padding: 10 }}>
        <Text style={[styles.heading, { color: palette.text }]}>Edit project</Text>
        {isLocked ? (
          <Text style={[styles.notice, { color: palette.warning }]}>
            Approved projects cannot be edited. Manage documents on the Documentation tab.
          </Text>
        ) : null}

        <FormProvider {...methods}>
          <View style={styles.form}>
            <FormInput name="name" label="Project name" />
            <FormInput name="sector" label="Sector" />
            <FormInput name="location" label="Location" />
            <FormInput name="targetAmount" label="Target amount (₦)" keyboardType="decimal-pad" />
            <FormInput name="summary" label="Summary" multiline />
            <FormInput name="fullDetails" label="Full details" multiline />
            <FormInput name="risks" label="Risks" multiline />
            <FormInput name="timeline" label="Timeline" multiline />
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Escrow bank details</Text>
            <FormInput name="bankName" label="Bank name" />
            <FormInput name="accountName" label="Account name" />
            <FormInput name="accountNumber" label="Account number" keyboardType="numeric" />
          </View>
        </FormProvider>

        <View style={styles.actions}>
          <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
          <Button
            title="Save changes"
            onPress={onSubmit}
            loading={updateProject.isPending}
            disabled={isLocked}
          />
        </View>
      </KeyboardAvoidingScreen>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  notice: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.sm,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
});
