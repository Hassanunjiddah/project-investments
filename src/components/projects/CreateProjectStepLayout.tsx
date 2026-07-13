import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import type { ReactNode } from 'react';
import { Button } from '@/src/components/ui/Button';
import { KeyboardAvoidingScreen } from '@/src/components/ui/KeyboardAvoidingScreen';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  step: 1 | 2 | 3 | 4;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  onSaveExit?: () => void;
  nextLabel?: string;
  nextLoading?: boolean;
  nextDisabled?: boolean;
  showBack?: boolean;
};

const STEP_LABELS = ['Basics', 'Details', 'Documents', 'Review'];

export function CreateProjectStepLayout({
  step,
  title,
  subtitle,
  children,
  onBack,
  onNext,
  onSaveExit,
  nextLabel = 'Next',
  nextLoading,
  nextDisabled,
  showBack = true,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <KeyboardAvoidingScreen>
      <View style={styles.progress}>
        {STEP_LABELS.map((label, index) => {
          const stepNum = (index + 1) as 1 | 2 | 3 | 4;
          const active = stepNum === step;
          const done = stepNum < step;
          return (
            <View key={label} style={styles.progressItem}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: active || done ? palette.primary : palette.border,
                  },
                ]}
              />
              <Text
                style={[
                  styles.stepLabel,
                  { color: active ? palette.primary : palette.textSecondary },
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
      ) : null}

      <View style={styles.content}>{children}</View>

      <View style={styles.actions}>
        {showBack && onBack ? (
          <Button title="Back" variant="secondary" onPress={onBack} style={styles.actionButton} />
        ) : null}
        {onSaveExit ? (
          <Button
            title="Save & exit"
            variant="secondary"
            onPress={onSaveExit}
            style={styles.actionButton}
          />
        ) : null}
        {onNext ? (
          <Button
            title={nextLabel}
            onPress={onNext}
            loading={nextLoading}
            disabled={nextDisabled}
            style={styles.actionButton}
          />
        ) : null}
      </View>
    </KeyboardAvoidingScreen>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  progressItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepLabel: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  content: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    width: '100%',
  },
});
