import { ActivityIndicator, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { TaskCard } from '@/src/components/manager/TaskCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { ManagerEarningsCard } from '@/src/components/manager/ManagerEarningsCard';
import { formatNaira } from '@/src/utils/currency';
import { spacing } from '@/src/constants/spacing';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { useFetchStats } from '@/src/hooks/stats/useFetchStats';
import { useFetchTasks } from '@/src/hooks/tasks/useFetchTasks';
import { useManagerProfitSummary } from '@/src/hooks/profits/useProfits';

export default function ManagerHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
    isRefetching: statsRefetching,
  } = useFetchStats();

  const {
    data: tasks = [],
    refetch: refetchTasks,
    isRefetching: tasksRefetching,
  } = useFetchTasks();

  const {
    data: activeProjects,
    isPending: projectsLoading,
    refetch: refetchProjects,
    isRefetching: projectsRefetching,
  } = useFetchProjects({
    limit: 3,
    status: 'APPROVED',
  });

  const {
    data: earnings,
    isLoading: earningsLoading,
    refetch: refetchEarnings,
  } = useManagerProfitSummary();

  const todayTasks = tasks.slice(0, 5);
  const isRefetching = statsRefetching || tasksRefetching || projectsRefetching;

  const handleRefresh = () => {
    refetchStats();
    refetchTasks();
    refetchProjects();
    refetchEarnings();
  };

  return (
    <ScreenLayout hideThemeToggle>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <AppHeader userName={user?.fullName ?? 'Manager'} notificationCount={tasks.length} />
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
            icon="trending-up-outline"
            label="Proj. Profit"
            value={statsLoading ? '—' : formatNaira(stats?.projectedProfitKobo ?? 0)}
          />
        </StatGrid>

        <SectionHeader title="Manager Earnings" />
        <ManagerEarningsCard
          loading={earningsLoading}
          managerShareKobo={earnings?.managerShareMinor ?? 0}
          totalRealisedKobo={earnings?.totalRealisedProfitMinor ?? 0}
          projectCount={earnings?.projectCount ?? 0}
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
                onPress={() => router.push(`/(tabs)/projects/${task.projectId}`)}
              />
            ))}

        <SectionHeader title="Funding Overview" />
        {projectsLoading ? (
          <ActivityIndicator />
        ) : (
          activeProjects?.data?.map((project) => (
            <ProjectProgressCard
              key={project.id}
              project={project}
              showInvestorCount
              onPress={() => router.push(`/(tabs)/projects/${project.id}`)}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
});
