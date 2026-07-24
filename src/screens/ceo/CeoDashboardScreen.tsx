import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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
import { typography } from '@/src/constants/typography';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { downloadTrialBalanceCsv, fetchTrialBalance } from '@/src/services/trialBalance.services';

export default function CeoDashboardScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const user = useAuthStore((s) => s.user);
  const [exporting, setExporting] = useState(false);

  const { data: allProjects } = useFetchProjects({ limit: 100 });
  const { data: pendingApprovals } = useFetchProjects({ status: 'PENDING', limit: 3 });
  const { data: activeProjects } = useFetchProjects({ status: 'APPROVED', limit: 4 });

  const handleExportTrialBalance = async () => {
    if (Platform.OS !== 'web') {
      pushToast({ type: 'error', message: 'CSV export is only available on web.' });
      return;
    }
    setExporting(true);
    try {
      const rows = await fetchTrialBalance();
      if (rows.length === 0) {
        pushToast({
          type: 'info',
          message: 'Ledger is empty — no trial balance to export yet.',
        });
        return;
      }
      downloadTrialBalanceCsv(rows);
      pushToast({ type: 'success', message: `Exported ${rows.length} ledger balances.` });
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Trial balance export failed.',
      });
    } finally {
      setExporting(false);
    }
  };

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
    <ScreenLayout hideThemeToggle>
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

        <Pressable
          onPress={handleExportTrialBalance}
          disabled={exporting}
          style={[
            styles.exportCard,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: exporting ? 0.6 : 1,
            },
          ]}
          data-testid="export-trial-balance-btn"
        >
          <View
            style={[
              styles.exportIcon,
              { backgroundColor: palette.primaryLight },
            ]}
          >
            <Feather name="download" size={18} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.exportTitle, { color: palette.text }]}>
              Trial Balance · CSV
            </Text>
            <Text style={[styles.exportSubtitle, { color: palette.textSecondary }]}>
              Auditor-ready ledger dump across every project. Includes per-account rollup
              and grand total (must equal ₦0).
            </Text>
          </View>
          <Text style={[styles.exportAction, { color: palette.primary }]}>
            {exporting ? 'Exporting…' : 'Download'}
          </Text>
        </Pressable>

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
  exportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  exportIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  exportSubtitle: { fontSize: typography.sizes.xs, marginTop: 2 },
  exportAction: { fontSize: typography.sizes.sm, fontWeight: '700' },
});
