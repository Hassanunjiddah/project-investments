import { useMemo } from 'react';
import { StyleSheet, View, Text, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { PageScroll } from '@/src/components/ui/PageScroll';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { Card } from '@/src/components/ui/Card';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { SparklineTile } from '@/src/components/ui/SparklineTile';
import { EarningBreakdownList } from '@/src/components/manager/EarningBreakdownList';
import {
  useEarningBreakdown,
  useManagerProfitSummary,
  useOwnerProfitSummary,
  useAllProfitUpdates,
} from '@/src/hooks/profits/useProfits';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { listFillStyle } from '@/src/constants/layout';
import { spacing, scrollBottomInset } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';

/**
 * Earnings tab — role-aware:
 *   LINE_MANAGER  → Prism platform fees from approved declarations
 *   PROJECT_OWNER → manager share from approved declarations
 */
export default function EarningsScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const isOwner = role === 'PROJECT_OWNER';

  const lm = useManagerProfitSummary();
  const owner = useOwnerProfitSummary();
  const breakdown = useEarningBreakdown(isOwner ? 'manager_share' : 'platform');
  const updates = useAllProfitUpdates(20);

  const summaryLoading = isOwner ? owner.isLoading : lm.isLoading;
  const isRefetching =
    (isOwner ? owner.isRefetching : lm.isRefetching) ||
    breakdown.isRefetching ||
    updates.isRefetching;

  const handleRefresh = () => {
    if (isOwner) void owner.refetch();
    else void lm.refetch();
    void breakdown.refetch();
    void updates.refetch();
  };

  const totalEarn = isOwner
    ? (owner.data?.managerShareMinor ?? 0)
    : (lm.data?.platformFeeMinor ?? 0);
  const totalRealised = isOwner
    ? (owner.data?.totalRealisedProfitMinor ?? 0)
    : (lm.data?.totalRealisedProfitMinor ?? 0);
  const earningProjects = isOwner
    ? (owner.data?.projectCount ?? 0)
    : (lm.data?.projectCount ?? 0);

  const avgPerProject =
    earningProjects > 0 ? Math.round(totalEarn / earningProjects) : 0;

  const trendPoints = useMemo(() => {
    const rows = breakdown.data ?? [];
    if (!rows.length) return [0, 0, 0, 0, 0, 0, 0, 0];
    const values = rows.slice(0, 8).map((r) => r.amountMinor / 100);
    while (values.length < 8) values.unshift(0);
    return values;
  }, [breakdown.data]);

  if (summaryLoading) {
    return (
      <ScreenLayout>
        <Spinner label="Loading earnings…" />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout>
      <PageScroll
        style={listFillStyle}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <Text style={[styles.title, { color: palette.text }]}>Earnings</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {isOwner
            ? 'Your manager share from approved profit declarations on projects you own.'
            : 'Prism platform fees from approved profit declarations on your projects.'}
        </Text>

        <Card interactive={false} elevated="md" style={styles.heroCard}>
          <HeroBalance
            label={isOwner ? 'Your manager share' : 'Prism platform fees'}
            valueMinor={totalEarn}
            subtitle={
              earningProjects === 0
                ? 'No approved declarations yet'
                : `From ${earningProjects} ${earningProjects === 1 ? 'project' : 'projects'}`
            }
            size="lg"
          />
        </Card>

        <View style={styles.grid}>
          <SparklineTile
            label="GROSS DECLARED · APPROVED"
            value={formatNaira(totalRealised)}
            meta="sum of approved declaration gross"
            tone="success"
            points={trendPoints}
            style={styles.gridChild}
          />
          <SparklineTile
            label="AVG PER EARNING PROJECT"
            value={formatNaira(avgPerProject)}
            meta={
              earningProjects === 0
                ? 'No earning projects yet'
                : `${earningProjects} contributing`
            }
            tone="brand"
            points={trendPoints}
            style={styles.gridChild}
          />
        </View>

        <SectionHeader title="Per-project breakdown" />
        <EarningBreakdownList
          rows={breakdown.data ?? []}
          amountLabel={isOwner ? 'Manager share' : 'Platform fee'}
          emptyMessage={
            isOwner
              ? 'When Prism declares and CEO approves profit, your manager share appears here.'
              : 'When you declare profit and CEO approves, Prism fees appear here.'
          }
          onProjectPress={(projectId) => router.push(`/projects/${projectId}`)}
        />
      </PageScroll>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset, gap: spacing.md },
  title: {
    fontFamily: typography.families.display,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: typography.sizes.sm, marginTop: -spacing.sm, marginBottom: spacing.xs },
  heroCard: {
    // Keep Card's default padding — zero padding + overflow:hidden was clipping
    // the ₦ mark and first digits of the hero amount.
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md + 4,
  },
  grid: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  gridChild: { flex: 1, minWidth: 140 },
});
