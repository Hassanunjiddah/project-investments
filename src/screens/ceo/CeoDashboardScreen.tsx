import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { ApprovalCard } from '@/src/components/ceo/ApprovalCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { formatNaira } from '@/src/utils/currency';
import { spacing } from '@/src/constants/spacing';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
export default function CeoDashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: allProjects } = useFetchProjects({ limit: 1 });
  const { data: pendingApprovals } = useFetchProjects({ status: 'PENDING', limit: 3 });
  const { data: activeProjects } = useFetchProjects({ status: 'APPROVED', limit: 4 });

  const stats = {
    totalProjects: allProjects?.count ?? 0,
    activeProjects: activeProjects?.count ?? 0,
    pendingApprovals: pendingApprovals?.count ?? 0,
  };

  return (
    <ScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppHeader
          userName="CEO"
          notificationCount={pendingApprovals?.count ?? 0}
          onNotificationPress={() => router.push('/(tabs)/approvals')}
        />
        <GreetingHeader
          name={user?.fullName ?? 'CEO'}
          subtitle="Here's what's happening on RibhShare today."
        />

        <StatGrid>
          <StatCard
            icon="briefcase-outline"
            label="Projects"
            value={String(stats.totalProjects)}
            // change={stats.projectsChange}
          />
          <StatCard
            icon="business-outline"
            label="Capital Raised"
            value={formatNaira(0)}
            // change={stats.capitalChange}
          />
          <StatCard
            icon="hourglass-outline"
            label="Pending"
            value={String(pendingApprovals?.count)}
            change={'0%'}
            changePositive={true}
          />
          <StatCard
            icon="people-outline"
            label="Investors"
            value={String(0)}
            // change={stats.investorsChange}
          />
        </StatGrid>

        {pendingApprovals?.count && pendingApprovals?.count > 0 ? (
          <>
            <SectionHeader
              title="Pending Approvals"
              count={pendingApprovals?.count}
              actionLabel="View all"
              onAction={() => router.push('/(tabs)/approvals')}
            />
            {pendingApprovals?.data.map((project) => (
              <ApprovalCard
                key={project.id}
                project={project}
                onPress={() => router.push(`/(tabs)/projects/${project.id}`)}
              />
            ))}
          </>
        ) : null}

        <SectionHeader title="Recently Active Projects" actionLabel="View all" />
        {activeProjects?.data.map((project) => (
          <ProjectProgressCard
            key={project.id}
            project={project}
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
