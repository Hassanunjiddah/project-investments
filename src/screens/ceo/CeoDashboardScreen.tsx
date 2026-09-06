import { useMemo, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { PageScroll } from '@/src/components/ui/PageScroll';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { SparklineTile } from '@/src/components/ui/SparklineTile';
import { Card } from '@/src/components/ui/Card';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { ApprovalCard } from '@/src/components/ceo/ApprovalCard';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Spinner } from '@/src/components/ui/Spinner';
import { formatNaira } from '@/src/utils/currency';
import { currentCapitalMinor } from '@/src/utils/projectMath';
import { spacing, scrollBottomInset } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { colors } from '@/src/constants/colors';
import { SITE_NAME } from '@/src/constants/site';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { downloadTrialBalanceCsv, fetchTrialBalance } from '@/src/services/trialBalance.services';
import {
  backfillLedger,
  checkLedgerIntegrity,
  type LedgerIntegrityResult,
} from '@/src/services/ledger.services';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { RecentUpdatesSection } from '@/src/components/nav/RecentUpdatesSection';

export default function CeoDashboardScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const user = useAuthStore((s) => s.user);
  const { items: notificationItems } = useNotifications();
  const [exporting, setExporting] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [checking, setChecking] = useState(false);
  const [integrity, setIntegrity] = useState<LedgerIntegrityResult | null>(null);

  const { data: allProjects, isLoading: allLoading, isError: allError, refetch: refetchAll } =
    useFetchProjects({ limit: 100 });
  const { data: pendingApprovals, isLoading: pendingLoading } = useFetchProjects({
    status: 'PENDING',
    limit: 3,
  });
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

  const handleCheckIntegrity = async () => {
    setChecking(true);
    try {
      const result = await checkLedgerIntegrity();
      setIntegrity(result);
      if (result.balanced && result.orphanCount === 0) {
        pushToast({
          type: 'success',
          message:
            result.transactionCount === 0
              ? 'Ledger is empty — trivially balanced.'
              : `Ledger balanced · ${result.transactionCount} transactions verified.`,
        });
      } else {
        pushToast({
          type: 'error',
          message: `Integrity issues: ${result.imbalancedCount} imbalanced · ${result.orphanCount} orphaned.`,
        });
      }
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Integrity check failed.',
      });
    } finally {
      setChecking(false);
    }
  };

  const stats = useMemo(() => {
    const rows = allProjects?.data ?? [];
    const totalRaisedKobo = rows.reduce((sum, p) => sum + (p.raisedMinor ?? 0), 0);
    const totalCurrentKobo = rows.reduce(
      (sum, p) =>
        sum +
        Math.max(0, currentCapitalMinor(p)),
      0,
    );
    const totalDrawnKobo = rows.reduce((sum, p) => sum + (p.drawnMinor ?? 0), 0);
    const totalRaiseFeeKobo = rows.reduce((sum, p) => sum + (p.raiseFeeMinor ?? 0), 0);
    return {
      totalProjects: allProjects?.count ?? rows.length,
      capitalRaisedKobo: totalRaisedKobo,
      currentCapitalKobo: totalCurrentKobo,
      drawnKobo: totalDrawnKobo,
      raiseFeeKobo: totalRaiseFeeKobo,
      pendingApprovals: pendingApprovals?.count ?? 0,
      activeProjects: activeProjects?.count ?? 0,
    };
  }, [allProjects, pendingApprovals, activeProjects]);

  if (allLoading && pendingLoading) return <Spinner label="Loading dashboard…" />;
  if (allError) {
    return (
      <EmptyState
        title="Could not load the dashboard"
        message="Check your connection and try again."
        actionLabel="Retry"
        onAction={() => void refetchAll()}
      />
    );
  }

  return (
    <ScreenLayout hideThemeToggle>
      <PageScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <AppHeader
          userName={user?.fullName ?? 'CEO'}
        />
        <GreetingHeader
          name={user?.fullName ?? 'CEO'}
          subtitle={`Here's what's happening on ${SITE_NAME} today.`}
        />

        {/* Hero — cumulative capital raised (subscriptions) */}
        <Card interactive={false} elevated="md" style={styles.heroCard}>
          <HeroBalance
            label="CAPITAL RAISED · ALL PROJECTS"
            valueMinor={stats.capitalRaisedKobo}
            subtitle={`Across ${stats.totalProjects} ${stats.totalProjects === 1 ? 'project' : 'projects'} · ${stats.activeProjects} live`}
            size="lg"
          />
        </Card>

        {/* Current capital after raise fees + paid drawdowns */}
        <Card interactive={false} elevated="md" style={styles.heroCard}>
          <HeroBalance
            label="CURRENT CAPITAL · ALL PROJECTS"
            valueMinor={stats.currentCapitalKobo}
            subtitle={
              stats.raiseFeeKobo > 0 || stats.drawnKobo > 0
                ? [
                    stats.raiseFeeKobo > 0
                      ? `${formatNaira(stats.raiseFeeKobo)} raise fees`
                      : null,
                    stats.drawnKobo > 0
                      ? `${formatNaira(stats.drawnKobo)} drawn to owners`
                      : null,
                    'remaining deployable',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : 'No raise fees or drawdowns yet — equals capital raised'
            }
            size="lg"
          />
        </Card>

        {/* Sparkline grid */}
        <View style={styles.grid}>
          <SparklineTile
            label="ACTIVE PROJECTS"
            value={String(stats.activeProjects)}
            meta={
              stats.pendingApprovals > 0
                ? `${stats.pendingApprovals} pending review`
                : 'All caught up'
            }
            tone="brand"
            points={buildProjectRaisedSpark(allProjects?.data ?? [])}
            style={styles.gridChild}
            onPress={() => router.push('/projects')}
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
          <View style={[styles.exportIcon, { backgroundColor: palette.primaryLight }]}>
            <Feather name="download" size={18} color={palette.primary} />
          </View>
          <View style={styles.exportBody}>
            <Text style={[styles.exportTitle, { color: palette.text }]}>Trial Balance · CSV</Text>
            <Text style={[styles.exportSubtitle, { color: palette.textSecondary }]}>
              Auditor-ready ledger dump across every project. Includes per-account rollup and grand
              total (must equal ₦0).
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
          <View style={[styles.exportIcon, { backgroundColor: palette.primaryLight }]}>
            <Feather name="rotate-ccw" size={18} color={palette.primary} />
          </View>
          <View style={styles.exportBody}>
            <Text style={[styles.exportTitle, { color: palette.text }]}>
              Backfill Historical Ledger
            </Text>
            <Text style={[styles.exportSubtitle, { color: palette.textSecondary }]}>
              Post ledger entries for confirmed invites and approved declarations that predate the
              auto-post triggers. Idempotent — safe to re-run.
            </Text>
          </View>
          <Text style={[styles.exportAction, { color: palette.primary }]}>
            {backfilling ? 'Running…' : 'Run'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleCheckIntegrity}
          disabled={checking}
          style={[
            styles.exportCard,
            {
              backgroundColor: palette.surface,
              borderColor: palette.border,
              opacity: checking ? 0.6 : 1,
              marginTop: spacing.sm,
            },
          ]}
          data-testid="check-integrity-btn"
          testID="check-integrity-btn"
          accessibilityRole="button"
          accessibilityLabel="Check ledger integrity"
        >
          <View
            style={[
              styles.exportIcon,
              {
                backgroundColor: integrity
                  ? integrity.balanced && integrity.orphanCount === 0
                    ? palette.semantic.success.bg
                    : palette.semantic.danger.bg
                  : palette.primaryLight,
              },
            ]}
          >
            <Feather
              name={
                integrity
                  ? integrity.balanced && integrity.orphanCount === 0
                    ? 'shield'
                    : 'alert-triangle'
                  : 'shield'
              }
              size={18}
              color={
                integrity
                  ? integrity.balanced && integrity.orphanCount === 0
                    ? palette.semantic.success.fg
                    : palette.semantic.danger.fg
                  : palette.primary
              }
            />
          </View>
          <View style={styles.exportBody}>
            <Text style={[styles.exportTitle, { color: palette.text }]}>
              Ledger Integrity Check
            </Text>
            {integrity ? (
              <Text
                style={[
                  styles.exportSubtitle,
                  {
                    color:
                      integrity.balanced && integrity.orphanCount === 0
                        ? palette.semantic.success.fg
                        : palette.semantic.danger.fg,
                  },
                ]}
              >
                {integrity.transactionCount === 0
                  ? 'Empty book · trivially balanced.'
                  : integrity.balanced && integrity.orphanCount === 0
                    ? `Balanced · ${integrity.transactionCount} tx · ${integrity.rowCount} rows · DR=CR=${formatNaira(integrity.totalDrMinor)}`
                    : `${integrity.imbalancedCount} imbalanced · ${integrity.orphanCount} orphans · delta ${formatNaira(integrity.grandDeltaMinor)}`}
              </Text>
            ) : (
              <Text style={[styles.exportSubtitle, { color: palette.textSecondary }]}>
                Verify every transaction balances (DR=CR), grand total closes to ₦0, and no orphan
                refs. Read-only — safe to run any time.
              </Text>
            )}
          </View>
          <Text style={[styles.exportAction, { color: palette.primary }]}>
            {checking ? 'Checking…' : integrity ? 'Re-check' : 'Check'}
          </Text>
        </Pressable>

        {integrity && integrity.imbalancedCount > 0 ? (
          <Card interactive={false} elevated="sm" style={{ marginTop: spacing.sm }}>
            <Text
              style={[
                styles.exportTitle,
                { color: palette.semantic.danger.fg, marginBottom: spacing.xs },
              ]}
            >
              Imbalanced transactions ({integrity.imbalancedCount})
            </Text>
            {integrity.imbalanced.slice(0, 10).map((row) => (
              <View
                key={row.transactionRef}
                style={{
                  paddingVertical: 6,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: palette.border,
                }}
              >
                <Text
                  style={[
                    styles.exportSubtitle,
                    { color: palette.text, fontFamily: typography.families.mono },
                  ]}
                >
                  {row.transactionRef}
                </Text>
                <Text style={[styles.exportSubtitle, { color: palette.textSecondary }]}>
                  {row.refType ?? '—'} · DR {formatNaira(row.drMinor)} · CR{' '}
                  {formatNaira(row.crMinor)} · delta {formatNaira(row.deltaMinor)}
                </Text>
              </View>
            ))}
            {integrity.imbalancedCount > 10 ? (
              <Text style={[styles.exportSubtitle, { color: palette.textSecondary, marginTop: 4 }]}>
                +{integrity.imbalancedCount - 10} more…
              </Text>
            ) : null}
          </Card>
        ) : null}

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
                onPress={() => router.push(`/projects/${project.id}`)}
              />
            ))}
          </>
        ) : null}

        <SectionHeader
          title="Recently Active Projects"
          actionLabel="View all"
          onAction={() => router.push('/projects')}
        />
        {activeProjects?.data.length ? (
          activeProjects.data.map((project) => (
            <ProjectProgressCard
              key={project.id}
              project={project}
              onPress={() => router.push(`/projects/${project.id}`)}
            />
          ))
        ) : (
          <EmptyState title="No active projects" message="Approved projects will appear here." />
        )}

        <RecentUpdatesSection items={notificationItems} />
      </PageScroll>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset },
  heroCard: { marginBottom: spacing.md },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  gridChild: {
    flexGrow: 1,
    flexBasis: '45%',
    minWidth: 200,
    marginBottom: 0,
  },
  exportCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  // Lets the action label wrap below the copy instead of squashing it on
  // narrow phones.
  exportBody: { flexGrow: 1, flexShrink: 1, flexBasis: 200 },
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
function buildProjectRaisedSpark(projects: { raisedMinor: number }[]) {
  const values = [...projects]
    .sort((a, b) => a.raisedMinor - b.raisedMinor)
    .slice(-8)
    .map((p) => p.raisedMinor / 100);
  while (values.length < 8) values.unshift(0);
  return values;
}
