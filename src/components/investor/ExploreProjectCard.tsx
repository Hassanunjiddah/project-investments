import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { getFundingProgress, getDaysLeft } from '@/db/selectors';
import { ProgressBar } from '../ui/ProgressBar';
import type { MockProjectWithCreator } from '@/db/types/project';

type Props = {
  project: MockProjectWithCreator;
  onPress?: () => void;
};

export function ExploreProjectCard({ project, onPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const progress = getFundingProgress(project);
  const daysLeft = getDaysLeft(project.fundingDeadline);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      onPress={onPress}
    >
      <Image source={{ uri: project.coverImageUrl }} style={styles.image} contentFit="cover" />
      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          {project.name}
        </Text>
        <Text style={[styles.sector, { color: palette.textSecondary }]}>{project.sector}</Text>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>
          Target: {formatNaira(project.targetKobo)}
        </Text>
        <Text style={[styles.roi, { color: palette.primary }]}>
          Est. ROI: {project.estimatedRoiPct}%
        </Text>
        {daysLeft !== null ? (
          <Text style={[styles.days, { color: palette.warning }]}>{daysLeft} days left</Text>
        ) : null}
        <View style={styles.progressRow}>
          <ProgressBar progress={progress} showLabel={false} />
          <Text style={[styles.funded, { color: palette.textSecondary }]}>{progress}% funded</Text>
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
  image: { width: 88, height: 88, borderRadius: 8 },
  body: { flex: 1 },
  title: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  sector: { fontSize: typography.sizes.xs, marginTop: 2 },
  meta: { fontSize: typography.sizes.xs, marginTop: spacing.xs },
  roi: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, marginTop: 2 },
  days: { fontSize: 10, fontWeight: typography.weights.semibold, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  funded: { fontSize: 10, minWidth: 56, textAlign: 'right' },
});
