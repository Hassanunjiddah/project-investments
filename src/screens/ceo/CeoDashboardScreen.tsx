import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { SparklineTile } from '@/src/components/ui/SparklineTile';
import { Card } from '@/src/components/ui/Card';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { ApprovalCard } from '@/src/components/ceo/ApprovalCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira } from '@/src/utils/currency';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { colors } from '@/src/constants/colors';
import { SITE_NAME } from '@/src/constants/site';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { downloadTrialBalanceCsv, fetchTrialBalance } from '@/src/services/trialBalance.services';
import { backfillLedger } from '@/src/services/ledger.services';

export default function CeoDashboardScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const user = useAuthStore((s) => s.user);
  const [exporting, setExporting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const { data: allProjects } = useFetchProjects({ limit: 100 });
  const { data: pendingApprovals } = useFetchProjects({ status: 'PENDING', limit: 3 });
  const { data: activeProjects } = useFetchProjects({ status: 'APPROVED', limit: 4 });

  const handleExportTrialBalance = async () => {    if (Platform.OS !== 'web') {
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

  const handleBackfillLedger = async () => {
    setBackfilling(true);
    try {
      const r = await backfillLedger();
      const total = r.invitesBackfilled + r.declarationsBackfilled + r.finalReturnsBackfilled;
      if (total === 0) {
        pushToast({
          type: 'info',
          message: 'Ledger already up to date — nothing to backfill.',
        });
      } else {
        pushToast({
          type: 'success',
          message: `Backfilled ${r.invitesBackfilled} invites · ${r.declarationsBackfilled} declarations · ${r.finalReturnsBackfilled} capital returns.`,
        });
      }
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Ledger backfill failed.',
      });
    } finally {
      setBackfilling(false);
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
          subtitle={`Here's what's happening on ${SITE_NAME} today.`}
        />

        {/* Hero — total capital under management */}
        <Card interactive={false} elevated="md" style={styles.heroCard}>
          <HeroBalance
            label="CAPITAL RAISED · ALL PROJECTS"
            valueMinor={stats.capitalRaisedKobo}
            subtitle={`Across ${stats.totalProjects} ${stats.totalProjects === 1 ? 'project' : 'projects'} · ${stats.activeProjects} live`}
            size="lg"
          />
        </Card>

        {/* Sparkline grid */}
        <View style={styles.grid}>
          <SparklineTile
            label="ACTIVE PROJECTS"
            value={String(stats.activeProjects)}
            meta={stats.pendingApprovals > 0 ? `${stats.pendingApprovals} pending review` : 'All caught up'}
            tone="brand"
            points={buildProjectRaisedSpark(allProjects?.data ?? [])}
            style={styles.gridChild}
            onPress={() => router.push('/(tabs)/projects')}
          />
          <SparklineTile
            label="PENDING APPROVALS"
            value={String(stats.pendingApprovals)}
            meta={stats.pendingApprovals === 0 ? 'Nothing waiting' : 'Tap to review'}
            tone={stats.pendingApprovals > 0 ? 'warning' : 'success'}
            points={[0, 1, 0, 2, 1, 3, 2, stats.pendingApprovals]}
            style={styles.gridChild}
            onPress={() => router.push('/(tabs)/approvals')}
          />
        </View>

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

        <Pressable
          onPress={handleBackfillLedger}
          disabled={backfilling}
          style={[
            styles.exportCard,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: backfilling ? 0.6 : 1,
              marginTop: spacing.sm,
            },
          ]}
          data-testid="backfill-ledger-btn"
          testID="backfill-ledger-btn"
          accessibilityRole="button"
          accessibilityLabel="Backfill historical ledger entries"
        >
          <View
            style={[
              styles.exportIcon,
              { backgroundColor: palette.primaryLight },
            ]}
          >
            <Feather name="rotate-ccw" size={18} color={palette.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.exportTitle, { color: palette.text }]}>
              Backfill Historical Ledger
            </Text>
            <Text style={[styles.exportSubtitle, { color: palette.textSecondary }]}>
              Post ledger entries for confirmed invites and approved declarations that
              predate the auto-post triggers. Idempotent — safe to re-run.
            </Text>
          </View>
          <Text style={[styles.exportAction, { color: palette.primary }]}>
            {backfilling ? 'Running…' : 'Run'}
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
  heroCard: { marginBottom: spacing.md },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  gridChild: {
    flex: 1,
    minWidth: 240,
    marginBottom: 0,
  },
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

/**
 * Build a lightweight 8-point spark from a project list — projects are
 * sorted by raised amount (desc) and we return the last 8 raised values.
 * Enough shape for a "how the deal book looks" glance.
 */
function buildProjectRaisedSpark(projects: Array<{ raisedMinor: number }>) {
  const values = [...projects]
    .sort((a, b) => a.raisedMinor - b.raisedMinor)
    .slice(-8)
    .map((p) => p.raisedMinor / 100);
  while (values.length < 8) values.unshift(0);
  return values;
}
