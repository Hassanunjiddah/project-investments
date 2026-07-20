import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { ApprovalCard } from '@/src/components/ceo/ApprovalCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira } from '@/src/utils/currency';
import { spacing } from '@/src/constants/spacing';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';

export default function CeoDashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const { data: allProjects } = useFetchProjects({ limit: 100 });
  const { data: pendingApprovals } = useFetchProjects({ status: 'PENDING', limit: 3 });
  const { data: activeProjects } = useFetchProjects({ status: 'APPROVED', limit: 4 });

  const stats = useMemo(() => {
    const rows = allProjects?.data ?? [];
    const totalRaisedKobo = rows.reduce((sum, p) => sum + (p.raisedMinor ?? 0), 0);
    return {
      totalProjects: allProjects?.count ?? rows.length,
      capitalRaisedKobo: totalRaisedKobo,
      pendingApprovals: pendingApprovals?.count ?? 0,
      activeProjects: activeProjects?.count ?? 0,
    };
  }, [allProjects, pendingApprovals, activeProjects]);

  return (
    <ScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppHeader
          userName={user?.fullName ?? 'CEO'}
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
          />
          <StatCard
            icon="business-outline"
            label="Capital Raised"
            value={formatNaira(stats.capitalRaisedKobo)}
          />
          <StatCard
            icon="hourglass-outline"
            label="Pending"
            value={String(stats.pendingApprovals)}
          />
          <StatCard
            icon="rocket-outline"
            label="Active"
            value={String(stats.activeProjects)}
          />
        </StatGrid>

        {stats.pendingApprovals > 0 ? (
          <>
            <SectionHeader
              title="Pending Approvals"
              count={stats.pendingApprovals}
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

        <SectionHeader
          title="Recently Active Projects"
          actionLabel="View all"
          onAction={() => router.push('/(tabs)/projects')}
        />
        {activeProjects?.data.length ? (
          activeProjects.data.map((project) => (
            <ProjectProgressCard
              key={project.id}
              project={project}
              onPress={() => router.push(`/(tabs)/projects/${project.id}`)}
            />
          ))
        ) : (
          <EmptyState
            title="No active projects"
            message="Approved projects will appear here."
          />
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
});
