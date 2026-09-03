import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { StageBadge } from '@/src/components/ui/StageBadge';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { colors } from '@/src/constants/colors';
import { spacing, scrollBottomInset } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';
import {
  fetchOwnerDashboardStats,
  fetchOwnerProjects,
} from '@/src/services/ownerDashboard.services';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { RecentUpdatesSection } from '@/src/components/nav/RecentUpdatesSection';
import { useOwnerProfitSummary } from '@/src/hooks/profits/useProfits';

/**
 * Project Owner dashboard — only projects where this user is `project_owner_id`
 * (assigned by Prism Line Manager). No visibility into other Prism deals.
 */
export default function OwnerHomeScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const user = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.session?.user?.id) ?? user?.id;
  const { items: notificationItems } = useNotifications();

  const {
    data: projects = [],
    isLoading: projectsLoading,
    isError: projectsError,
    error: projectsErr,
    refetch: refetchProjects,
    isRefetching: projectsRefetching,
  } = useQuery({
    queryKey: ['owner-dashboard-projects', userId],
    enabled: !!userId,
    queryFn: () => fetchOwnerProjects(userId!),
    refetchInterval: 45_000,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
    isRefetching: statsRefetching,
  } = useQuery({
    queryKey: ['owner-dashboard-stats', userId],
    enabled: !!userId,
    queryFn: () => fetchOwnerDashboardStats(userId!),
    refetchInterval: 45_000,
  });

  const { data: ownerEarnings } = useOwnerProfitSummary();

  const isRefetching = projectsRefetching || statsRefetching;
  const handleRefresh = () => {
    refetchProjects();
    refetchStats();
  };

  const raisedPct =
    stats && stats.totalTargetMinor > 0
      ? Math.min(100, Math.round((stats.totalRaisedMinor / stats.totalTargetMinor) * 100))
      : 0;

  if (projectsError) {
    return (
      <ScreenLayout hideThemeToggle>
        <EmptyState
          icon="alert-circle"
          title="Could not load your dashboard"
          message={projectsErr instanceof Error ? projectsErr.message : 'Please try again.'}
          actionLabel="Retry"
          onAction={() => handleRefresh()}
        />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout hideThemeToggle>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <AppHeader userName={user?.fullName ?? 'Project Owner'} />
        <GreetingHeader
          name={user?.fullName ?? 'Owner'}
          subtitle="Your originator dashboard — only deals Prism assigned you to own."
        />

        <StatGrid>
          <StatCard
            icon="briefcase-outline"
            label="My projects"
            value={statsLoading ? '—' : String(stats?.projectCount ?? 0)}
          />
          <StatCard
            icon="trending-up-outline"
            label="In progress"
            value={statsLoading ? '—' : String(stats?.inProgressCount ?? 0)}
          />
          <StatCard
            icon="cash-outline"
            label="Raised on my deals"
            value={statsLoading ? '—' : formatNaira(stats?.totalRaisedMinor ?? 0)}
          />
          <StatCard
            icon="wallet-outline"
            label="Manager share"
            value={formatNaira(ownerEarnings?.managerShareMinor ?? 0)}
          />
        </StatGrid>

        <Pressable onPress={() => router.push('/(tabs)/earnings' as never)}>
          <Text style={{ color: palette.primary, fontWeight: '600', marginBottom: spacing.sm }}>
            View earnings →
          </Text>
        </Pressable>

        {(stats?.pendingDrawdowns ?? 0) > 0 || (stats?.proposedProfits ?? 0) > 0 ? (
          <View
            style={[
              styles.attention,
              { borderColor: palette.border, backgroundColor: palette.surfaceMuted },
            ]}
          >
            <Text style={[styles.attentionTitle, { color: palette.text }]}>
              In flight with Prism
            </Text>
            {stats && stats.pendingDrawdowns > 0 ? (
              <Pressable onPress={() => router.push('/projects' as never)}>
                <Text style={[styles.attentionItem, { color: palette.textSecondary }]}>
                  {stats.pendingDrawdowns} drawdown request
                  {stats.pendingDrawdowns === 1 ? '' : 's'} awaiting Line Manager approval
                </Text>
              </Pressable>
            ) : null}
            {stats && stats.proposedProfits > 0 ? (
              <Pressable onPress={() => router.push('/projects' as never)}>
                <Text style={[styles.attentionItem, { color: palette.textSecondary }]}>
                  {stats.proposedProfits} profit proposal
                  {stats.proposedProfits === 1 ? '' : 's'} with your Line Manager
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <SectionHeader
          title="Assigned projects"
          count={projects.length}
          actionLabel={projects.length > 0 ? 'View all' : undefined}
          onAction={
            projects.length > 0 ? () => router.push('/projects' as never) : undefined
          }
        />

        {projectsLoading ? (
          <Text style={{ color: palette.muted }}>Loading your projects…</Text>
        ) : projects.length === 0 ? (
          <EmptyState
            icon="folder"
            title="No projects assigned yet"
            message="When a Prism Line Manager invites you as project owner on a deal, it will appear here — and only there."
          />
        ) : (
          projects.slice(0, 3).map((item) => {
            const pct =
              item.targetMinor > 0
                ? Math.min(100, Math.round((item.raisedMinor / item.targetMinor) * 100))
                : 0;
            return (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/projects/${item.id}` as never)}
                style={[
                  styles.card,
                  { borderColor: palette.border, backgroundColor: palette.surface },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.name}`}
              >
                <View style={styles.top}>
                  <Text style={[styles.code, { color: palette.muted }]} selectable>
                    {item.code}
                  </Text>
                  <StageBadge stage={item.stage as never} />
                </View>
                <Text style={[styles.name, { color: palette.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: palette.textSecondary }]}>
                  Raised {formatNaira(item.raisedMinor)} of {formatNaira(item.targetMinor)} · {pct}%
                </Text>
                <View style={[styles.track, { backgroundColor: palette.border }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${pct}%`,
                        backgroundColor: pct >= 100 ? palette.semantic.success.fg : palette.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.cta, { color: palette.primary }]}>
                  Open · drawdowns, profits, message Prism
                </Text>
              </Pressable>
            );
          })
        )}

        <RecentUpdatesSection items={notificationItems} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset, gap: spacing.sm },
  attention: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: 4,
    marginBottom: spacing.sm,
  },
  attentionTitle: { fontSize: typography.sizes.sm, fontWeight: '700' },
  attentionItem: { fontSize: typography.sizes.xs, lineHeight: 18 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: 6,
    marginBottom: spacing.sm,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontFamily: 'monospace', fontSize: typography.sizes.xs, fontWeight: '600' },
  name: { fontSize: typography.sizes.md, fontWeight: '600' },
  meta: { fontSize: typography.sizes.xs },
  track: { height: 4, borderRadius: 999, overflow: 'hidden', marginTop: 4 },
  fill: { height: '100%', borderRadius: 999 },
  cta: { fontSize: typography.sizes.xs, fontWeight: '600', marginTop: 4 },
});
