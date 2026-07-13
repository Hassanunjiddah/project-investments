import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, useColorScheme } from 'react-native';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { projectDetailsSchema, type ProjectDetailsFormValues } from '@/src/schemas/project.schema';
import { FormInput } from '@/src/components/form/FormInput';
import { CreateProjectStepLayout } from '@/src/components/projects/CreateProjectStepLayout';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
};

export function CreateProjectStepDetails({ onNext, onBack, onSaveExit }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const details = useProjectDraftStore((s) => s.draft.details);
  const setDetails = useProjectDraftStore((s) => s.setDetails);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const methods = useForm<ProjectDetailsFormValues>({
    resolver: zodResolver(projectDetailsSchema) as Resolver<ProjectDetailsFormValues>,
    defaultValues: details,
    mode: 'onBlur',
  });

  useEffect(() => {
    const subscription = methods.watch((values) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setDetails(values as ProjectDetailsFormValues);
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [methods, setDetails]);

  const handleNext = methods.handleSubmit((values) => {
    setDetails(values);
    onNext();
  });

  const handleSaveExit = () => {
    setDetails(methods.getValues());
    onSaveExit();
  };

  return (
    <CreateProjectStepLayout
      step={2}
      title="Project details"
      subtitle="Summary, risks, timeline, and optional Mudarabah terms."
      onBack={onBack}
      onNext={handleNext}
      onSaveExit={handleSaveExit}
    >
      <FormProvider {...methods}>
        <View style={styles.form}>
          <FormInput name="summary" label="Summary" multiline />
          <FormInput name="fullDetails" label="Full details" multiline />
          <FormInput name="risks" label="Risks" multiline />
          <FormInput name="timeline" label="Timeline" multiline />

          <FormInput
            name="estimatedRoiPct"
            label="Projected profit (%)"
            keyboardType="decimal-pad"
          />

          <View style={styles.publicRow}>
            <View style={styles.publicText}>
              <Text style={[styles.sectionHeading, { color: palette.text }]}>Public project</Text>
              <Text style={[styles.sectionHint, { color: palette.textSecondary }]}>
                Visible in Explore when approved. Off = invite-only.
              </Text>
            </View>
            <Switch
              value={methods.watch('isPublic') ?? false}
              onValueChange={(v) => methods.setValue('isPublic', v)}
              trackColor={{ true: palette.primary }}
            />
          </View>

          <Text style={[styles.sectionHeading, { color: palette.text }]}>Escrow bank details</Text>
          <Text style={[styles.sectionHint, { color: palette.textSecondary }]}>
            Shown to investors after they commit payment.
          </Text>
          <FormInput name="bankName" label="Bank name" />
          <FormInput name="accountName" label="Account name" />
          <FormInput name="accountNumber" label="Account number" keyboardType="numeric" />

          <Pressable onPress={() => setShowAdvanced((v) => !v)}>
            <Text style={[styles.advancedToggle, { color: palette.primary }]}>
              {showAdvanced ? 'Hide advanced terms' : 'Show advanced Mudarabah terms'}
            </Text>
          </Pressable>

          {showAdvanced ? (
            <>
              <FormInput
                name="profitSplitInvestorBps"
                label="Investor profit share (bps, e.g. 7000 = 70%)"
                keyboardType="numeric"
              />
              <FormInput name="exitNoticeDays" label="Exit notice (days)" keyboardType="numeric" />
              <FormInput
                name="earlyExitPenaltyBps"
                label="Early exit penalty (bps)"
                keyboardType="numeric"
              />
            </>
          ) : null}
        </View>
      </FormProvider>
    </CreateProjectStepLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  advancedToggle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  sectionHeading: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.sm,
  },
  sectionHint: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.xs,
  },
  publicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  publicText: { flex: 1 },
});
