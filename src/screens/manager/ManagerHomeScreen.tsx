import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { TaskCard } from '@/src/components/manager/TaskCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useMockUserId } from '@/src/hooks/useMockUserId';
import { formatNaira } from '@/src/utils/currency';
import { spacing } from '@/src/constants/spacing';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';

export default function ManagerHomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userId = useMockUserId();
  const version = useMockDataStore((s) => s.version);
  const getManagerDashboard = useMockDataStore((s) => s.getManagerDashboard);

  const { data: totalProjects } = useFetchProjects({ limit: 1 });
  const {
    data: activeProjects,
    isPending: projectsLoading,
    refetch: refetchProjects,
  } = useFetchProjects({
    limit: 3,
    status: 'APPROVED',
  });

  const { data: pendingApprovals } = useFetchProjects({
    limit: 1,
    status: 'PENDING',
  });

  const stats = {
    totalProjects: totalProjects?.count ?? 0,
    activeProjects: activeProjects?.count ?? 0,
    pendingApprovals: pendingApprovals?.count ?? 0,
    totalRaisedKobo: 0,
    raisedChange: 0,
    activeInvestors: 0,
    investorsChange: 0,
    projectedProfitKobo: 0,
    profitChange: 0,
  };

  const onRefresh = () => {};

  void version;
  const { tasks } = getManagerDashboard(userId);

  return (
    <ScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppHeader userName={user?.fullName ?? 'Manager'} notificationCount={5} />
        <GreetingHeader
          name={user?.fullName ?? 'Manager'}
          subtitle="Here's what's happening with your projects today."
        />

        <StatGrid>
          <StatCard
            icon="briefcase-outline"
            label="Total Projects"
            value={String(stats.totalProjects)}
            // change={stats.projectsChange}
          />
          <StatCard
            icon="cash-outline"
            label="Total Raised"
            value={formatNaira(stats.totalRaisedKobo)}
            // change={stats.raisedChange}
          />
          <StatCard
            icon="people-outline"
            label="Investors"
            value={String(stats.activeInvestors)}
            // change={stats.investorsChange}
          />
          <StatCard
            icon="trending-up-outline"
            label="Proj. Profit"
            value={formatNaira(stats.projectedProfitKobo)}
            // change={stats.profitChange}
          />
        </StatGrid>

        <SectionHeader title="Today's Tasks" count={tasks.length} actionLabel="View all" />
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
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
