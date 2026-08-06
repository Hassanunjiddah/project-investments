import { ActivityIndicator, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { TaskCard } from '@/src/components/manager/TaskCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { ManagerProfitBreakdown } from '@/src/components/manager/ManagerProfitBreakdown';
import { formatNaira } from '@/src/utils/currency';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { useFetchStats } from '@/src/hooks/stats/useFetchStats';
import { useFetchTasks } from '@/src/hooks/tasks/useFetchTasks';
import { useManagerProfitSummary } from '@/src/hooks/profits/useProfits';
import { tabForTask } from '@/src/services/tasks.services';

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

  const todayTasks = tasks.slice(0, 5);
  const isRefetching = statsRefetching || tasksRefetching || projectsRefetching;
  const projectList = allProjects?.data ?? [];
  const projectsForOverview = projectList.slice(0, 3);
  const totalRealisedKobo = earnings?.totalRealisedProfitMinor ?? 0;

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
            icon="checkmark-circle-outline"
            label="Total Realised Profit"
            value={formatNaira(totalRealisedKobo)}
          />
        </StatGrid>

        <SectionHeader title="Profit Sources" />
        <ManagerProfitBreakdown
          projects={projectList}
          onProjectPress={(projectId) => router.push(`/(tabs)/projects/${projectId}`)}
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
                  router.push(`/(tabs)/projects/${task.projectId}?${q.toString()}` as never);
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
              onPress={() => router.push(`/(tabs)/projects/${project.id}`)}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset },
});
