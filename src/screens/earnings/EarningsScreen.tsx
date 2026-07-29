import { useMemo } from 'react';
import { ScrollView, StyleSheet, View, Text, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { Card } from '@/src/components/ui/Card';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { SparklineTile } from '@/src/components/ui/SparklineTile';
import { ManagerProfitBreakdown } from '@/src/components/manager/ManagerProfitBreakdown';
import { useManagerProfitSummary, useAllProfitUpdates } from '@/src/hooks/profits/useProfits';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing, scrollBottomInset } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

/**
 * LM-only Earnings tab (Phase D refresh).
 *
 * Top: institutional HeroBalance card (deep navy surface) with total
 * manager share + delta to last period.
 * Grid: two SparklineTiles showing "Realised profit trend" (from the
 * last 8-12 profit-update buckets) and "Avg per earning project".
 * Middle: per-project breakdown (unchanged).
 * Bottom: activity feed of recent profit updates, rendered in the new
 * card idiom.
 */
export default function EarningsScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const {
    data: earnings,
    isLoading: earningsLoading,
    refetch: refetchEarnings,
    isRefetching: earningsRefetching,
  } = useManagerProfitSummary();

  const {
    data: projectsList,
    isLoading: projectsLoading,
    refetch: refetchProjects,
    isRefetching: projectsRefetching,
  } = useFetchProjects({ limit: 100, status: 'APPROVED' });

  const {
    data: allUpdates = [],
    isLoading: updatesLoading,
    refetch: refetchUpdates,
    isRefetching: updatesRefetching,
  } = useAllProfitUpdates(20);

  const isRefetching = earningsRefetching || projectsRefetching || updatesRefetching;

  const handleRefresh = () => {
    refetchEarnings();
    refetchProjects();
    refetchUpdates();
  };

  const totalManagerShare = earnings?.managerShareMinor ?? 0;
  const totalRealised = earnings?.totalRealisedProfitMinor ?? 0;
  const earningProjects = earnings?.projectCount ?? 0;
  const projects = projectsList?.data ?? [];
  const projectsWithProfit = projects.filter((p) => p.realisedProfitMinor > 0).length;
  const avgPerProject =
    projectsWithProfit > 0 ? Math.round(totalManagerShare / projectsWithProfit) : 0;

  // Build a compact sparkline from the last 8 profit updates (chronological).
  const trendPoints = useMemo(() => {
    if (!allUpdates.length) return [0, 0, 0, 0, 0, 0, 0, 0];
    const sorted = [...allUpdates].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const values = sorted.slice(-8).map((u) => u.amountMinor / 100);
    // Pad the start to always have 8 points so tiles look consistent.
    while (values.length < 8) values.unshift(0);
    return values;
  }, [allUpdates]);

  // For per-project trend we bucket count vs realisation for a rough shape.
  const perProjectPoints = useMemo(() => {
    if (!projects.length) return [0, 0, 0, 0, 0, 0, 0, 0];
    return projects
      .slice(0, 8)
      .map((p) => p.realisedProfitMinor / 100)
      .concat(new Array(Math.max(0, 8 - projects.length)).fill(0))
      .slice(0, 8);
  }, [projects]);

  // Simple "vs last update" delta for the hero.
  const heroDelta = useMemo(() => {
    if (allUpdates.length < 2) return undefined;
    const sorted = [...allUpdates].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const last = sorted[0]?.amountMinor ?? 0;
    if (last === 0) return undefined;
    const bps =
      (sorted[0] as unknown as { profitSplitInvestorBps?: number }).profitSplitInvestorBps ?? 7000;
    const lastManagerCut = Math.round((last * (10000 - bps)) / 10000);
    return {
      label: `${formatNaira(lastManagerCut)} last update`,
      direction: 'up' as const,
    };
  }, [allUpdates]);

  if (earningsLoading && projectsLoading) {
    return (
      <ScreenLayout>
        <Spinner label="Loading earnings…" />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <Text style={[styles.title, { color: palette.text }]}>Earnings</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Your realised manager share across all active projects.
        </Text>

        {/* Hero */}
        <Card interactive={false} elevated="md" style={styles.heroCard}>
          <HeroBalance
            label="YOUR TOTAL EARNINGS"
            valueMinor={totalManagerShare}
            delta={heroDelta}
            subtitle={
              earningProjects === 0
                ? 'No projects earning yet'
                : `From ${earningProjects} ${earningProjects === 1 ? 'project' : 'projects'}`
            }
            size="lg"
          />
        </Card>

        {/* Sparkline grid */}
        <View style={styles.grid}>
          <SparklineTile
            label="REALISED PROFIT · LAST 8"
            value={formatNaira(totalRealised)}
            meta="all-time realised, across projects"
            tone="success"
            points={trendPoints}
            style={styles.gridChild}
          />
          <SparklineTile
            label="AVG PER EARNING PROJECT"
            value={formatNaira(avgPerProject)}
            meta={
              projectsWithProfit === 0
                ? 'No earning projects yet'
                : `${projectsWithProfit} ${projectsWithProfit === 1 ? 'project' : 'projects'} contributing`
            }
            tone="brand"
            points={perProjectPoints}
            style={styles.gridChild}
          />
        </View>

        <SectionHeader title="Per-project breakdown" />
        <ManagerProfitBreakdown
          projects={projects}
          onProjectPress={(projectId) => router.push(`/(tabs)/projects/${projectId}`)}
        />

        <SectionHeader title="Recent profit updates" />
        {updatesLoading ? (
          <Spinner size="small" />
        ) : allUpdates.length === 0 ? (
          <EmptyState
            title="No profit updates yet"
            message="When you post a realised profit on any project it will appear here."
          />
        ) : (
          <View>
            {allUpdates.map((u) => {
              const bps =
                (u as unknown as { profitSplitInvestorBps?: number }).profitSplitInvestorBps ??
                7000;
              const managerCut = Math.round((u.amountMinor * (10000 - bps)) / 10000);
              const managerPct = ((10000 - bps) / 100).toFixed(0);
              return (
                <Card
                  key={u.id}
                  style={styles.updateCard}
                  onPress={() => router.push(`/(tabs)/projects/${u.projectId}`)}
                >
                  <View style={styles.updateRow}>
                    <View
                      style={[
                        styles.updateIcon,
                        { backgroundColor: palette.brand[50], borderColor: palette.brand[100] },
                      ]}
                    >
                      <Ionicons name="arrow-up-circle" size={16} color={palette.brand[700]} />
                    </View>
                    <View style={styles.updateInfo}>
                      <Text style={[styles.updateTitle, { color: palette.text }]} numberOfLines={1}>
                        {u.projectName ?? 'Project'}
                      </Text>
                      <Text style={[styles.updateMeta, { color: palette.textSecondary }]}>
                        {formatNaira(u.amountMinor)} realised · {managerPct}% share ·{' '}
                        {new Date(u.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      {u.note ? (
                        <Text
                          style={[styles.updateNote, { color: palette.muted }]}
                          numberOfLines={2}
                        >
                          {u.note}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.updateAmount, tabularNums, { color: palette.brand[700] }]}>
                      +{formatNaira(managerCut)}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset },
  title: {
    fontFamily: typography.families.display,
    fontSize: 32,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.6,
    lineHeight: 36,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  heroCard: { marginBottom: spacing.md },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  gridChild: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 200,
    marginBottom: 0,
  },
  updateCard: { padding: spacing.md, marginBottom: spacing.sm },
  updateRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  updateIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateInfo: { flexGrow: 1, flexShrink: 1, flexBasis: 160, gap: 2 },
  updateTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  updateMeta: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  updateNote: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  updateAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
