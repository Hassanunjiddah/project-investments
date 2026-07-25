import { ScrollView, StyleSheet, View, Text, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { Card } from '@/src/components/ui/Card';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ManagerProfitBreakdown } from '@/src/components/manager/ManagerProfitBreakdown';
import { useManagerProfitSummary, useAllProfitUpdates } from '@/src/hooks/profits/useProfits';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

/**
 * LM-only Earnings tab (Feb 2026): hero total, per-project breakdown, and a
 * cross-project timeline of recent profit updates so the LM can see when
 * their next payout was booked and from which project.
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
        <View style={styles.heroWrap}>
          <View
            style={[
              styles.hero,
              { backgroundColor: palette.primary },
              // Gradient only on web (RN native doesn't support backgroundImage)
              Platform.OS === 'web'
                ? ({
                    backgroundImage: `linear-gradient(135deg, ${palette.primary} 0%, ${palette.primaryHover} 100%)`,
                  } as any)
                : null,
            ]}
          >
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(255,255,255,0.16)' }]}>
              <Ionicons name="cash" size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.heroLabel}>Your total earnings</Text>
            <Text
              style={styles.heroValue}
              data-testid="earnings-total-value"
            >
              {formatNaira(totalManagerShare, false)}
            </Text>
            <Text style={styles.heroMeta}>
              {earningProjects === 0
                ? 'No projects earning yet'
                : `From ${earningProjects} ${earningProjects === 1 ? 'project' : 'projects'}`}
            </Text>
          </View>
        </View>

        <StatGrid>
          <StatCard
            label="Realised (all)"
            value={formatNaira(totalRealised)}
            icon="stats-chart-outline"
          />
          <StatCard
            label="Avg / project"
            value={formatNaira(avgPerProject)}
            icon="trending-up-outline"
          />
        </StatGrid>

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
              // Manager cut for THIS specific update = amount × (10000 - investorBps) / 10000
              const bps = (u as unknown as { profitSplitInvestorBps?: number }).profitSplitInvestorBps ?? 7000;
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
                      style={[styles.updateIcon, { backgroundColor: palette.primaryLight }]}
                    >
                      <Ionicons name="arrow-up-circle" size={16} color={palette.primary} />
                    </View>
                    <View style={styles.updateInfo}>
                      <Text
                        style={[styles.updateTitle, { color: palette.text }]}
                        numberOfLines={1}
                      >
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
                    <Text style={[styles.updateAmount, { color: palette.primary }]}>
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
  scroll: { paddingBottom: spacing.xxl },
  heroWrap: { marginBottom: spacing.md },
  hero: {
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xxl + 4,
    fontWeight: typography.weights.bold,
    letterSpacing: -1,
    marginTop: 4,
    // @ts-expect-error web-only
    fontVariantNumeric: 'tabular-nums',
  },
  heroMeta: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: typography.sizes.sm,
    marginTop: 6,
  },
  updateCard: { padding: spacing.md, marginBottom: spacing.sm },
  updateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  updateIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateInfo: { flex: 1, minWidth: 0 },
  updateTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  updateMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  updateNote: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
  updateAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
    // @ts-expect-error web-only
    fontVariantNumeric: 'tabular-nums',
  },
});
