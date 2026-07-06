import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { ProgressBar } from '../ui/ProgressBar';
import { StageBadge } from '../ui/StageBadge';
import type { MockProjectWithCreator } from '@/db/types/project';
import type { PortfolioEntry } from '@/db/types/investment';

type Props = {
  project: MockProjectWithCreator;
  investment: PortfolioEntry;
  onPress?: () => void;
};

export function InvestmentCard({ project, investment, onPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <Pressable
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      onPress={onPress}
    >
      <Image source={{ uri: project.coverImageUrl }} style={styles.thumb} contentFit="cover" />
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {project.name}
          </Text>
          <StageBadge stage={project.stage} />
        </View>
        <Text style={[styles.sector, { color: palette.textSecondary }]}>{project.sector}</Text>
        <View style={styles.progressRow}>
          <ProgressBar progress={investment.progressPct} showLabel={false} />
          <Text style={[styles.progressPct, { color: palette.text }]}>
            {investment.progressPct}%
          </Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Invested</Text>
            <Text style={[styles.value, { color: palette.text }]}>
              {formatNaira(investment.amountKobo)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Projected Profit</Text>
            <Text style={[styles.value, { color: palette.success }]}>
              {formatNaira(investment.projectedProfitKobo)} ({project.estimatedRoiPct}%)
            </Text>
          </View>
        </View>
        {investment.estimatedCompletion ? (
          <Text style={[styles.completion, { color: palette.muted }]}>
            Est. Completion: {investment.estimatedCompletion}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  thumb: { width: 72, height: 72, borderRadius: 8 },
  body: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  sector: { fontSize: typography.sizes.xs, marginTop: 2, marginBottom: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressPct: { fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, minWidth: 32 },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  statItem: { flex: 1 },
  label: { fontSize: 10 },
  value: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 2 },
  completion: { fontSize: 10, marginTop: spacing.xs },
});
