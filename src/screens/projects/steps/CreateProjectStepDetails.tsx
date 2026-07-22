import { useEffect, useRef, useState } from 'react';
import { FormProvider, UseFormReturn } from 'react-hook-form';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';

import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { FormInput } from '@/src/components/form/FormInput';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { type ProjectDetailsFormValues } from '@/src/schemas/project.schema';

type Props = {
  methods: UseFormReturn<ProjectDetailsFormValues>;
};

export function CreateProjectStepDetails({ methods }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const setDetails = useProjectDraftStore((s) => s.setDetails);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <View>
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

          <FormInput
            name="managerSharePct"
            label="Manager profit share (%)"
            keyboardType="decimal-pad"
          />
          <Text style={[styles.sectionHint, { color: palette.textSecondary }]}>
            Default is 30%. Investors will receive the remaining share of all realised profits.
            Range 0–50%.
          </Text>

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
    </View>
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
