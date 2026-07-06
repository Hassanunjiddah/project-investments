import { ScrollView, StyleSheet } from 'react-native';
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

export default function ManagerHomeScreen() {
  const router = useRouter();
  const userId = useMockUserId();
  const version = useMockDataStore((s) => s.version);
  const getManagerDashboard = useMockDataStore((s) => s.getManagerDashboard);

  void version;
  const { stats, tasks, fundingOverview } = getManagerDashboard(userId);

  return (
    <ScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppHeader userName="Khadija" notificationCount={5} />
        <GreetingHeader
          name="Khadija"
          subtitle="Here's what's happening with your projects today."
        />

        <StatGrid>
          <StatCard
            icon="briefcase-outline"
            label="Total Projects"
            value={String(stats.totalProjects)}
            change={stats.projectsChange}
          />
          <StatCard
            icon="cash-outline"
            label="Total Raised"
            value={formatNaira(stats.totalRaisedKobo)}
            change={stats.raisedChange}
          />
          <StatCard
            icon="people-outline"
            label="Investors"
            value={String(stats.activeInvestors)}
            change={stats.investorsChange}
          />
          <StatCard
            icon="trending-up-outline"
            label="Proj. Profit"
            value={formatNaira(stats.projectedProfitKobo)}
            change={stats.profitChange}
          />
        </StatGrid>

        <SectionHeader title="Today's Tasks" count={tasks.length} actionLabel="View all" />
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}

        <SectionHeader title="Funding Overview" />
        {fundingOverview.map((project) => (
          <ProjectProgressCard
            key={project.id}
            project={project}
            showInvestorCount
            onPress={() => router.push(`/(tabs)/projects/${project.id}`)}
          />
        ))}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
});
