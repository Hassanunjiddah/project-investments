import { View, Text, StyleSheet, Platform } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  steps: string[];
  currentStep: number;
};

/**
 * Prism Capital step indicator.
 *
 * Renders as a horizontal rail of pill-shaped segments — one per step.
 * The active segment is filled with the brand primary, completed
 * segments show a filled brand primary bar, and pending segments show
 * a muted track. Labels sit beneath each segment.
 *
 * Design language: soft, minimal, editorial. No circles / connector
 * dots — just clean progress bars á la Robinhood / Cash App onboarding.
 */
export function StepIndicator({ steps, currentStep }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View
      style={styles.wrap}
      {...(Platform.OS === 'web'
        ? ({
            role: 'progressbar',
            'aria-valuemin': 1,
            'aria-valuemax': steps.length,
            'aria-valuenow': currentStep,
            'aria-label': `Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1]}`,
          } as Record<string, unknown>)
        : {})}
    >
      <View style={styles.segments}>
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const done = stepNum < currentStep;
          const active = stepNum === currentStep;
          return (
            <View
              key={label}
              style={[
                styles.segment,
                {
                  backgroundColor: done || active ? palette.primary : palette.border,
                },
                active ? styles.segmentActive : null,
              ]}
            />
          );
        })}
      </View>
      <View style={styles.labels}>
        {steps.map((label, i) => {
          const stepNum = i + 1;
          const done = stepNum < currentStep;
          const active = stepNum === currentStep;
          return (
            <View key={label} style={styles.labelCell}>
              <Text
                style={[
                  styles.stepNum,
                  {
                    color: active
                      ? palette.primary
                      : done
                        ? palette.text
                        : palette.textSecondary,
                  },
                ]}
              >
                {String(stepNum).padStart(2, '0')}
              </Text>
              <Text
                style={[
                  styles.label,
                  {
                    color: active ? palette.text : palette.textSecondary,
                  },
                  active ? styles.labelActive : null,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 999,
  },
  segmentActive: {
    // Slightly taller so active segment reads distinctly at a glance
    height: 5,
  },
  labels: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
  },
  labelCell: {
    flex: 1,
    gap: 2,
  },
  stepNum: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: typography.families.mono,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  labelActive: {
    fontWeight: typography.weights.semibold,
  },
});
