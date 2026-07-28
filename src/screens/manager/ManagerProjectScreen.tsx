import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { ProjectHero } from '@/src/components/ceo/ProjectHero';
import { StageBadge } from '@/src/components/ui/StageBadge';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { KeyDetailsList } from '@/src/components/ui/KeyDetailsList';
import { MilestoneStepper } from '@/src/components/manager/MilestoneStepper';
import { TabBar } from '@/src/components/ui/TabBar';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { mockToProject } from '@/src/helpers/mockToProject';
import { getFundingProgress } from '@/db/selectors';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Tab = 'overview' | 'investors' | 'activity' | 'documents' | 'financials';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'investors', label: 'Investors' },
  { key: 'activity', label: 'Activity' },
  { key: 'documents', label: 'Documents' },
  { key: 'financials', label: 'Financials' },
];

const ACTIONS = [
  { icon: 'person-add-outline' as const, label: 'Invite Investors' },
  { icon: 'megaphone-outline' as const, label: 'Project Update' },
  { icon: 'cloud-upload-outline' as const, label: 'Upload Document' },
  { icon: 'people-outline' as const, label: 'View Investors' },
];

export default function ManagerProjectScreen() {
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

  return (
    <ScreenLayout>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.projectId, { color: palette.muted }]}>{project.id}</Text>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {project.name}
          </Text>
        </View>
        <Pressable style={styles.iconBtn}>
          <Ionicons name="ellipsis-vertical" size={18} color={palette.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ProjectHero
          imageUrl={project.coverImageUrl}
          height={160}
          badge={<StageBadge stage={project.stage} />}
        />

        <View style={styles.progressHeader}>
          <Text style={[styles.raised, { color: palette.textSecondary }]}>
            {formatNaira(project.raisedKobo, false)} of {formatNaira(project.targetKobo, false)}{' '}
            raised
          </Text>
          <Text style={[styles.progressPct, { color: palette.text }]}>{progress}%</Text>
        </View>
        <ProgressBar progress={progress} showLabel={false} height={6} />

        <View style={styles.quickStats}>
          {[
            { icon: 'people-outline' as const, label: `${project.investorCount ?? 0} Investors` },
            { icon: 'calendar-outline' as const, label: `${project.durationMonths} months` },
            { icon: 'trending-up-outline' as const, label: `${project.estimatedRoiPct}% Est. ROI` },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Ionicons name={s.icon} size={14} color={palette.primary} />
              <Text style={[styles.statText, { color: palette.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionGrid}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.label}
              style={[styles.actionBtn, { backgroundColor: palette.primaryLight }]}
            >
              <Ionicons name={a.icon} size={18} color={palette.primary} />
              <Text style={[styles.actionLabel, { color: palette.primary }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <TabBar tabs={TABS} activeKey={tab} onChange={(k) => setTab(k as Tab)} />

        {tab === 'overview' && (
          <View>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Project Summary</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>{project.summary}</Text>
            <KeyDetailsList project={mockToProject(project)} />
            {project.milestones ? <MilestoneStepper milestones={project.milestones} /> : null}
          </View>
        )}
        {tab === 'investors' && (
          <Text style={[styles.body, { color: palette.muted }]}>
            {project.investorCount ?? 0} investors connected.
          </Text>
        )}
        {tab === 'activity' && (
          <Text style={[styles.body, { color: palette.muted }]}>No recent activity.</Text>
        )}
        {tab === 'documents' && (
          <Text style={[styles.body, { color: palette.muted }]}>
            {documents.length} document(s) on file.
          </Text>
        )}
        {tab === 'financials' && (
          <Text style={[styles.body, { color: palette.textSecondary }]}>
            Target: {formatNaira(project.targetKobo)} · Raised: {formatNaira(project.raisedKobo)}
          </Text>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconBtn: { width: 32, alignItems: 'center', padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  projectId: { fontSize: 10, textAlign: 'center' },
  name: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, textAlign: 'center' },
  scroll: { paddingBottom: scrollBottomInset },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  raised: { fontSize: typography.sizes.xs, flex: 1 },
  progressPct: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: spacing.md,
  },
  stat: { alignItems: 'center', gap: 4 },
  statText: { fontSize: 10, fontWeight: typography.weights.medium },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: {
    width: '47%',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: 10,
    gap: 4,
  },
  actionLabel: { fontSize: 10, fontWeight: typography.weights.medium, textAlign: 'center' },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  body: { fontSize: typography.sizes.sm, lineHeight: 20 },
});
