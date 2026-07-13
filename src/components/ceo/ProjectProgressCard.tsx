import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import { getFundingProgress } from '@/db/selectors';
import { ProgressBar } from '../ui/ProgressBar';
import { StageBadge } from '../ui/StageBadge';
import { Project } from '@/src/types/project.types';

type Props = {
  project: Project;
  showInvestorCount?: boolean;
  onPress?: () => void;
};

export function ProjectProgressCard({ project, showInvestorCount, onPress }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const progress = getFundingProgress(project);

  const content = (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Image source={{ uri: project.bannerUrl }} style={styles.thumb} contentFit="cover" />

      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
              {project.name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={[styles.sector, { color: palette.textSecondary }]}>
                {project.sector}
              </Text>
              <View style={styles.progressBlock}>
                <Text style={[styles.progressPct, { color: palette.text }]}>{progress}%</Text>
                <Text style={[styles.progressLabel, { color: palette.muted }]}>Progress</Text>
              </View>
            </View>
          </View>
        </View>
        <ProgressBar progress={progress} showLabel={false} />
        <View style={styles.footerRow}>
          <Text style={[styles.raised, { color: palette.textSecondary }]}>
            {formatNaira(project.raisedKobo)} of {formatNaira(project.targetKobo)} raised
          </Text>
          <StageBadge stage={project.stage} />
        </View>
        {/* {showInvestorCount && project.investorCount ? (
          <Text style={[styles.investors, { color: palette.muted }]}>
            {project.investorCount} investors
          </Text>
        ) : null} */}
      </View>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  topRow: { gap: spacing.sm, marginBottom: spacing.sm },
  thumb: { width: 90, height: 90, borderRadius: 8 },
  header: { flex: 1 },
  titleRow: {
    // flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  progressBlock: { alignItems: 'flex-end' },
  progressPct: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
  progressLabel: { fontSize: 10 },
  sector: { fontSize: typography.sizes.xs, marginTop: 2 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  raised: { fontSize: typography.sizes.xs, flex: 1 },
  investors: { fontSize: typography.sizes.xs, marginTop: 4 },
});
