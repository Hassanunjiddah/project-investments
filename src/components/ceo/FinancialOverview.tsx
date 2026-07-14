import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { getFundingProgress } from '@/db/selectors';
import { ProgressBar } from '../ui/ProgressBar';
import { Project } from '@/src/types/project.types';

type Props = {
  project: Project;
  mode?: 'manager' | 'investor';
  /** Cap available to this investor (min of invite max and remaining raise) */
  investableMaxMinor?: number;
};

export function FinancialOverview({
  project,
  mode = 'manager',
  investableMaxMinor,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const progress = getFundingProgress(project);
  const remaining = Math.max(0, project.targetMinor - project.raisedMinor);

  if (mode === 'investor') {
    const hasInviteMax = investableMaxMinor != null;
    const primaryLabel = hasInviteMax ? 'Available to you' : 'Remaining';
    const primaryValue = hasInviteMax ? investableMaxMinor! : remaining;

    return (
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>{primaryLabel}</Text>
            <Text style={[styles.value, { color: palette.text }]}>
              {formatNaira(primaryValue)}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Projected Profit</Text>
            <Text style={[styles.value, { color: palette.text }]}>
              {project.estimatedRoiBps / 100}% Est. ROI
            </Text>
          </View>
        </View>
        <Text style={[styles.progressLabel, { color: palette.muted }]}>
          {formatNaira(project.raisedMinor)} already raised
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={[styles.label, { color: palette.textSecondary }]}>Target Amount</Text>
          <Text style={[styles.value, { color: palette.text }]}>
            {formatNaira(project.targetMinor)}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={[styles.label, { color: palette.textSecondary }]}>Projected Profit</Text>
          <Text style={[styles.value, { color: palette.text }]}>
            {project.estimatedRoiBps / 100}% Est. ROI
          </Text>
        </View>
      </View>
      <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
        {formatNaira(project.raisedMinor)} already raised ({progress}%)
      </Text>
      <ProgressBar progress={progress} showLabel={false} height={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  col: { flex: 1 },
  label: { fontSize: typography.sizes.xs, marginBottom: 4 },
  value: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold },
  progressLabel: { fontSize: typography.sizes.xs, marginBottom: spacing.xs },
});
