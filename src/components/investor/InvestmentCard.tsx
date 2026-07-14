import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { ProgressBar } from '../ui/ProgressBar';
import { StageBadge } from '../ui/StageBadge';
import type { PortfolioEntry } from '@/src/types/portfolio.types';

type Props = {
  entry: PortfolioEntry;
  onPress?: () => void;
};

export function InvestmentCard({ entry, onPress }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const roiPct = entry.estimatedRoiBps / 100;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      onPress={onPress}
    >
      {entry.projectBannerUrl ? (
        <Image source={{ uri: entry.projectBannerUrl }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View
          style={[styles.thumb, styles.thumbFallback, { backgroundColor: palette.primaryLight }]}
        >
          <Ionicons name="image-outline" size={22} color={palette.primary} />
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {entry.projectName}
          </Text>
          <StageBadge stage={entry.projectStage} />
        </View>
        {entry.projectSector ? (
          <Text style={[styles.sector, { color: palette.textSecondary }]}>{entry.projectSector}</Text>
        ) : null}
        <View style={styles.progressRow}>
          <ProgressBar progress={entry.progressPct} showLabel={false} />
          <Text style={[styles.progressPct, { color: palette.text }]}>{entry.progressPct}%</Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Invested</Text>
            <Text style={[styles.value, { color: palette.text }]}>
              {formatNaira(entry.capitalKobo)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: palette.textSecondary }]}>Projected Profit</Text>
            <Text style={[styles.value, { color: palette.success }]}>
              {formatNaira(entry.projectedReturnKobo)} ({roiPct}%)
            </Text>
          </View>
        </View>
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
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
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
  progressPct: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    minWidth: 32,
  },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  statItem: { flex: 1 },
  label: { fontSize: 10 },
  value: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    marginTop: 2,
  },
});
