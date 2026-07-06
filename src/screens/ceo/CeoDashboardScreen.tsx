import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { ApprovalCard } from '@/src/components/ceo/ApprovalCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useMockUserId } from '@/src/hooks/useMockUserId';
import { formatNaira } from '@/src/utils/currency';
import { spacing } from '@/src/constants/spacing';
import { useUiStore } from '@/src/store/useUiStore';

export default function CeoDashboardScreen() {
  const router = useRouter();
  const userId = useMockUserId();
  const version = useMockDataStore((s) => s.version);
  const approveProject = useMockDataStore((s) => s.approveProject);
  const rejectProject = useMockDataStore((s) => s.rejectProject);
  const getCeoDashboard = useMockDataStore((s) => s.getCeoDashboard);
  const getPendingApprovalCount = useMockDataStore((s) => s.getPendingApprovalCount);
  const pushToast = useUiStore((s) => s.pushToast);

  void version;
  const dashboard = getCeoDashboard(userId);
  const { stats, pendingApprovals, activeProjects } = dashboard;

  return (
    <ScreenLayout>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <AppHeader
          userName="CEO"
          notificationCount={getPendingApprovalCount()}
          onNotificationPress={() => router.push('/(tabs)/approvals')}
        />
        <GreetingHeader
          name="CEO"
          subtitle="Here's what's happening on RibhShare today."
        />

        <StatGrid>
          <StatCard
            icon="briefcase-outline"
            label="Projects"
            value={String(stats.totalProjects)}
            change={stats.projectsChange}
          />
          <StatCard
            icon="business-outline"
            label="Capital Raised"
            value={formatNaira(stats.capitalRaisedKobo)}
            change={stats.capitalChange}
          />
          <StatCard
            icon="hourglass-outline"
            label="Pending"
            value={String(stats.pendingApprovals)}
            change={stats.approvalsChange}
            changePositive={false}
          />
          <StatCard
            icon="people-outline"
            label="Investors"
            value={String(stats.totalInvestors)}
            change={stats.investorsChange}
          />
        </StatGrid>

        <SectionHeader
          title="Pending Approvals"
          count={pendingApprovals.length}
          actionLabel="View all"
          onAction={() => router.push('/(tabs)/approvals')}
        />
        {pendingApprovals.slice(0, 3).map((project) => (
          <ApprovalCard
            key={project.id}
            project={project}
            onApprove={() => {
              approveProject(project.id);
              pushToast({ type: 'success', message: `${project.name} approved` });
            }}
            onReject={() => {
              rejectProject(project.id);
              pushToast({ type: 'success', message: `${project.name} rejected` });
            }}
            onPress={() => router.push(`/(tabs)/projects/${project.id}`)}
          />
        ))}

        <SectionHeader title="Recently Active Projects" actionLabel="View all" />
        {activeProjects.slice(0, 4).map((project) => (
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
