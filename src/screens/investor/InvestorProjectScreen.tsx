import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { StageBadge } from '@/src/components/ui/StageBadge';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { KeyDetailsList } from '@/src/components/ui/KeyDetailsList';
import { TabBar } from '@/src/components/ui/TabBar';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { mockToProject } from '@/src/helpers/mockToProject';
import { getFundingProgress, getDaysLeft } from '@/db/selectors';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Tab = 'overview' | 'details' | 'documents' | 'updates';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'details', label: 'Details' },
  { key: 'documents', label: 'Documents' },
  { key: 'updates', label: 'Updates' },
];

export default function InvestorProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [tab, setTab] = useState<Tab>('overview');
  const version = useMockDataStore((s) => s.version);
  const getProjectById = useMockDataStore((s) => s.getProjectById);
  const getDocumentsForProject = useMockDataStore((s) => s.getDocumentsForProject);

  void version;
  const project = getProjectById(id ?? '');
  const documents = getDocumentsForProject(id ?? '');

  if (!project) {
    return <EmptyState title="Project not found" />;
  }

  const progress = getFundingProgress(project);
  const daysLeft = getDaysLeft(project.fundingDeadline);

  return (
    <ScreenLayout>
      <View style={styles.heroWrap}>
        <Image
          source={{ uri: project.coverImageUrl }}
          style={styles.heroImage}
          contentFit="cover"
        />
        <View style={styles.heroOverlay}>
          <Pressable style={styles.heroBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#FFF" />
          </Pressable>
          <Pressable style={styles.heroBtn}>
            <Ionicons name="share-outline" size={18} color="#FFF" />
          </Pressable>
        </View>
        <View style={styles.heroBadge}>
          <StageBadge stage={project.stage} />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPad}>
        <Text style={[styles.name, { color: palette.text }]}>{project.name}</Text>
        <Text style={[styles.meta, { color: palette.textSecondary }]}>
          {project.sector} · By {project.creatorName}
          {project.creatorVerified ? ' ✓' : ''}
        </Text>

        <View
          style={[
            styles.metrics,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}
        >
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>
              Target Amount
            </Text>
            <Text style={[styles.metricValue, { color: palette.text }]}>
              {formatNaira(project.targetKobo)}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>Est. ROI</Text>
            <Text style={[styles.metricValue, { color: palette.text }]}>
              {project.estimatedRoiPct}%
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: palette.textSecondary }]}>Duration</Text>
            <Text style={[styles.metricValue, { color: palette.text }]}>
              {project.durationMonths} months
            </Text>
          </View>
        </View>

        <Text style={[styles.raised, { color: palette.textSecondary }]}>
          {formatNaira(project.raisedKobo)} raised · {progress}% funded
        </Text>
        <ProgressBar progress={progress} showLabel={false} height={6} />

        <TabBar tabs={TABS} activeKey={tab} onChange={(k) => setTab(k as Tab)} />

        {tab === 'overview' && (
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>About the Project</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{project.summary}</Text>
          </View>
        )}
        {tab === 'details' && <KeyDetailsList project={mockToProject(project)} />}
        {tab === 'documents' && (
          <Text style={[styles.body, { color: palette.muted }]}>
            {documents.length} document(s) available after accepting terms.
          </Text>
        )}
        {tab === 'updates' && (
          <Text style={[styles.body, { color: palette.muted }]}>No updates yet.</Text>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: palette.surface, borderTopColor: palette.border },
        ]}
      >
        {daysLeft !== null ? (
          <Text style={[styles.timeLeft, { color: palette.warning }]}>
            Time Left: {daysLeft} days
          </Text>
        ) : null}
        <Button
          title="View Investment Options"
          onPress={() => router.push(`/(tabs)/projects/${project.id}/invest`)}
          style={styles.footerBtn}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
    height: 180,
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadge: { position: 'absolute', bottom: spacing.sm, left: spacing.sm },
  scrollPad: { paddingBottom: 90 },
  name: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, marginBottom: 4 },
  meta: { fontSize: typography.sizes.xs, marginBottom: spacing.md },
  metrics: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { fontSize: 10, marginBottom: 2 },
  metricValue: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
  raised: { fontSize: typography.sizes.xs, marginBottom: spacing.xs },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  body: { fontSize: typography.sizes.sm, lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  timeLeft: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, flex: 1 },
  footerBtn: { flex: 1.5 },
});
