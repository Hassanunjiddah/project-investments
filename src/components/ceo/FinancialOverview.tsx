import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { formatUnits } from '@/src/utils/units';
import { getFundingProgress } from '@/db/selectors';
import { ProgressBar } from '../ui/ProgressBar';
import { Project } from '@/src/types/project.types';

type Props = {
  project: Project;
  mode?: 'manager' | 'investor' | 'owner';
  /** Cap available to this investor (min of invite max and remaining raise) */
  investableMaxMinor?: number;
  /** Units already spoken-for (COMMITTED/PROOF_SUBMITTED/CONFIRMED), if known */
  unitsSubscribed?: number;
};

export function FinancialOverview({
  project,
  mode = 'manager',
  investableMaxMinor,
  unitsSubscribed,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const progress = getFundingProgress(project);
  const remaining = Math.max(0, project.targetMinor - project.raisedMinor);
  const isUnitized = !!(project.totalUnits && project.totalUnits > 0);
  const unitsRemaining =
    isUnitized && typeof unitsSubscribed === 'number'
      ? Math.max(0, project.totalUnits! - unitsSubscribed)
      : undefined;

  if (mode === 'investor') {
    const hasInviteMax = investableMaxMinor != null;
    const primaryLabel = hasInviteMax ? 'Available to you' : 'Remaining';
    const primaryValue = hasInviteMax ? investableMaxMinor! : remaining;

    return (
      <View
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>{primaryLabel}</Text>
            <Text style={[styles.value, { color: palette.text }]}>{formatNaira(primaryValue)}</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>
              {isUnitized ? 'Unit Price' : 'Projected Profit'}
            </Text>
            <Text style={[styles.value, { color: palette.text }]}>
              {isUnitized
                ? formatNaira(project.unitPriceMinor ?? 0)
                : `${project.estimatedRoiBps / 100}% Est. ROI`}
            </Text>
          </View>
        </View>
        {isUnitized ? (
          <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
            {formatUnits(project.totalUnits!)} total units · min{' '}
            {formatUnits(project.minUnitsPerInvestor ?? 1)} per investor
          </Text>
        ) : null}
        <Text style={[styles.progressLabel, { color: palette.muted }]}>
          {formatNaira(project.raisedMinor)} already raised
        </Text>
      </View>
    );
  }

  if (mode === 'owner') {
    return (
      <View
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Raise target</Text>
            <Text style={[styles.value, { color: palette.text }]}>
              {formatNaira(project.targetMinor)}
            </Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Raised so far</Text>
            <Text style={[styles.value, { color: palette.text }]}>
              {formatNaira(project.raisedMinor)}
            </Text>
          </View>
        </View>
        <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
          {progress}% of target · Prism manages investors and payments
          {isUnitized ? ` · ${formatUnits(project.totalUnits!)} unit book` : ''}
        </Text>
        <Text style={[styles.progressLabel, { color: palette.muted }]}>
          Current capital {formatNaira(Math.max(0, project.raisedMinor - (project.drawnMinor ?? 0)))}
          {(project.drawnMinor ?? 0) > 0
            ? ` · ${formatNaira(project.drawnMinor)} drawn`
            : ''}
        </Text>
        <ProgressBar progress={progress} showLabel={false} height={6} />
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
          <Text style={[styles.label, { color: palette.textSecondary }]}>
            {isUnitized ? 'Unit Price' : 'Projected Profit'}
          </Text>
          <Text style={[styles.value, { color: palette.text }]}>
            {isUnitized
              ? formatNaira(project.unitPriceMinor ?? 0)
              : `${project.estimatedRoiBps / 100}% Est. ROI`}
          </Text>
        </View>
      </View>
      {isUnitized ? (
        <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
          {typeof unitsSubscribed === 'number'
            ? `${formatUnits(unitsSubscribed)} / ${formatUnits(project.totalUnits!)} units subscribed`
            : `${formatUnits(project.totalUnits!)} units · min ${formatUnits(project.minUnitsPerInvestor ?? 1)} per investor · Prism fee ${((project.platformFeeBps ?? 0) / 100).toFixed(1)}%`}
          {typeof unitsRemaining === 'number' && unitsRemaining > 0
            ? ` · ${formatUnits(unitsRemaining)} available`
            : ''}
        </Text>
      ) : null}
      <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
        {formatNaira(project.raisedMinor)} capital raised ({progress}%)
        {(project.drawnMinor ?? 0) > 0
          ? ` · current ${formatNaira(Math.max(0, project.raisedMinor - project.drawnMinor))}`
          : ''}
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    rowGap: spacing.sm,
    marginBottom: spacing.sm,
  },
  col: { flexGrow: 1, flexBasis: '40%', minWidth: 140 },
  label: { fontSize: typography.sizes.xs, marginBottom: 4 },
  value: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold },
  progressLabel: { fontSize: typography.sizes.xs, marginBottom: spacing.xs },
});
