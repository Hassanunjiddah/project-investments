import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  steps: string[];
  currentStep: number;
};

export function StepIndicator({ steps, currentStep }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View style={styles.wrap}>
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < currentStep;
        const active = stepNum === currentStep;
        const isLast = i === steps.length - 1;

        return (
          <View key={label} style={styles.stepWrap}>
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: done || active ? palette.primary : palette.surface,
                    borderColor: done || active ? palette.primary : palette.border,
                  },
                ]}
              >
                {done ? (
                  <Ionicons name="checkmark" size={12} color="#FFF" />
                ) : (
                  <Text style={[styles.num, { color: active ? '#FFF' : palette.muted }]}>
                    {stepNum}
                  </Text>
                )}
              </View>
              {!isLast ? (
                <View
                  style={[
                    styles.line,
                    { backgroundColor: done ? palette.primary : palette.border },
                  ]}
                />
              ) : null}
            </View>
            <Text
              style={[
                styles.label,
                { color: active ? palette.primary : palette.textSecondary },
                active && styles.activeLabel,
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', marginBottom: spacing.lg },
  stepWrap: { flex: 1, alignItems: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  line: {
    flex: 1,
    height: 2,
    marginHorizontal: 2,
    marginBottom: spacing.xs,
  },
  num: { fontSize: 10, fontWeight: typography.weights.bold },
  label: { fontSize: 10, textAlign: 'center' },
  activeLabel: { fontWeight: typography.weights.semibold },
});
