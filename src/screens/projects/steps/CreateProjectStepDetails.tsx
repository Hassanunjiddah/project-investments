import { useEffect, useRef, useState } from 'react';
import { FormProvider, UseFormReturn, useWatch } from 'react-hook-form';
import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';

import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { FormInput } from '@/src/components/form/FormInput';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { type ProjectDetailsFormValues } from '@/src/schemas/project.schema';
import {
  PROFIT_DECLARATION_FREQUENCIES,
  PROFIT_DECLARATION_FREQUENCY_LABELS,
  type ProfitDeclarationFrequency,
} from '@/src/types/project.types';

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
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        setDetails(methods.getValues());
      }
    };
  }, [methods, setDetails]);

  const profitFrequency =
    useWatch({ control: methods.control, name: 'profitDeclarationFrequency' }) ?? 'MONTHLY';

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

          <View style={styles.freqBlock}>
            <Text style={[styles.sectionHeading, { color: palette.text }]}>
              Profit declaration frequency
            </Text>
            <Text style={[styles.sectionHint, { color: palette.textSecondary }]}>
              How often realised profit should be declared for this project.
            </Text>
            <View style={styles.freqRow}>
              {PROFIT_DECLARATION_FREQUENCIES.map((freq) => {
                const selected = profitFrequency === freq;
                return (
                  <Pressable
                    key={freq}
                    onPress={() =>
                      methods.setValue('profitDeclarationFrequency', freq, {
                        shouldValidate: true,
                        shouldDirty: true,
                        shouldTouch: true,
                      })
                    }
                    style={[
                      styles.freqChip,
                      {
                        borderColor: selected ? palette.primary : palette.border,
                        backgroundColor: selected ? palette.primaryLight : palette.surface,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? palette.primary : palette.text,
                        fontSize: typography.sizes.xs,
                        fontWeight: selected ? '600' : '500',
                      }}
                    >
                      {PROFIT_DECLARATION_FREQUENCY_LABELS[freq as ProfitDeclarationFrequency]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <FormInput
            name="managerSharePct"
            label="Manager profit share (%)"
            keyboardType="decimal-pad"
          />
          <Text style={[styles.sectionHint, { color: palette.textSecondary }]}>
            Default is 30%. Investors receive the remainder. Range 0–50% —
            investors must always keep the majority share.
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
  freqBlock: { gap: spacing.xs },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  freqChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
});
