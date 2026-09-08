import { ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { PageScroll } from '@/src/components/ui/PageScroll';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { TaskCard } from '@/src/components/manager/TaskCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { EarningBreakdownList } from '@/src/components/manager/EarningBreakdownList';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira } from '@/src/utils/currency';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { useFetchStats } from '@/src/hooks/stats/useFetchStats';
import { useFetchTasks } from '@/src/hooks/tasks/useFetchTasks';
import { useEarningBreakdown, useManagerProfitSummary } from '@/src/hooks/profits/useProfits';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { RecentUpdatesSection } from '@/src/components/nav/RecentUpdatesSection';
import { tabForTask } from '@/src/services/tasks.services';

export default function ManagerHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { items: notificationItems } = useNotifications();

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    refetch: refetchStats,
    isRefetching: statsRefetching,
  } = useFetchStats();

  const {
    data: tasks = [],
    refetch: refetchTasks,
    isRefetching: tasksRefetching,
  } = useFetchTasks();

  // Fetch a larger page so the Profit Sources breakdown can see every
  // project the LM owns. Funding Overview slices to the first 3.
  const {
    data: allProjects,
    isPending: projectsLoading,
    refetch: refetchProjects,
    isRefetching: projectsRefetching,
  } = useFetchProjects({ limit: 100, status: 'APPROVED' });

  const {
    data: earnings,
    refetch: refetchEarnings,
  } = useManagerProfitSummary();
  const { data: feeBreakdown = [], refetch: refetchFees } = useEarningBreakdown('platform');

  const todayTasks = tasks.slice(0, 5);
  const isRefetching = statsRefetching || tasksRefetching || projectsRefetching;
  const projectList = allProjects?.data ?? [];
  const projectsForOverview = projectList.slice(0, 3);
  const platformFees = earnings?.platformFeeMinor ?? 0;

  const handleRefresh = () => {
    refetchStats();
    refetchTasks();
    refetchProjects();
    refetchEarnings();
    void refetchFees();
  };

  if (statsError) {
    return (
      <EmptyState
        title="Could not load your dashboard"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => void refetchStats()}
      />
    );
  }

  return (
    <ScreenLayout hideThemeToggle>
      <PageScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <AppHeader userName={user?.fullName ?? 'Manager'} />
        <GreetingHeader
          name={user?.fullName ?? 'Manager'}
          subtitle="Here's what's happening with your projects today."
        />

        <StatGrid>
          <StatCard
            icon="briefcase-outline"
            label="Total Projects"
            value={statsLoading ? '—' : String(stats?.totalProjects ?? 0)}
          />
          <StatCard
            icon="cash-outline"
            label="Total Raised"
            value={statsLoading ? '—' : formatNaira(stats?.totalRaisedKobo ?? 0)}
          />
          <StatCard
            icon="people-outline"
            label="Investors"
            value={statsLoading ? '—' : String(stats?.activeInvestors ?? 0)}
          />
          <StatCard
            icon="cash-outline"
            label="Total Prism fees"
            value={formatNaira(platformFees)}
          />
        </StatGrid>

        <SectionHeader title="Fee sources" />
        <EarningBreakdownList
          rows={feeBreakdown}
          amountLabel="Profit fee"
          emptyMessage="Raise fees and approved profit fees will show here."
          onProjectPress={(projectId) => router.push(`/projects/${projectId}`)}
        />

        <SectionHeader
          title="Today's Tasks"
          count={tasks.length}
          actionLabel="View all"
          onAction={() => router.push('/(tabs)/tasks')}
        />
        {todayTasks.length === 0
          ? null
          : todayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPress={() => {
                  const q = new URLSearchParams({ tab: tabForTask(task.dbKind) });
                  if (task.inviteId) q.set('invite', task.inviteId);
                  router.push(`/projects/${task.projectId}?${q.toString()}` as never);
                }}
              />
            ))}

        <SectionHeader title="Funding Overview" />
        {projectsLoading ? (
          <ActivityIndicator />
        ) : (
          projectsForOverview.map((project) => (
            <ProjectProgressCard
              key={project.id}
              project={project}
              showInvestorCount
              onPress={() => router.push(`/projects/${project.id}`)}
            />
          ))
        )}

        <RecentUpdatesSection items={notificationItems} />
      </PageScroll>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset },
});
