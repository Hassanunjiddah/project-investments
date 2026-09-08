import { useMemo, useState } from 'react';
import { FlatList, Text, StyleSheet, RefreshControl, View } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { ChipRow } from '@/src/components/ui/ChipRow';
import { PortfolioCard } from '@/src/components/ui/PortfolioCard';
import { InvestmentCard } from '@/src/components/investor/InvestmentCard';
import { InviteProjectCard } from '@/src/components/investor/InviteProjectCard';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { listFillStyle, listScrollEnabled } from '@/src/constants/layout';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { computePortfolioStats } from '@/src/services/portfolio.services';
import { investorProjectHref } from '@/src/helpers/routing';

type PortfolioFilter = 'active' | 'completed' | 'invitations';

export default function InvestorPortfolioScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [filter, setFilter] = useState<PortfolioFilter>('active');

  const {
    data: holdings,
    isLoading: holdingsLoading,
    isError: holdingsError,
    error: holdingsErr,
    refetch: refetchHoldings,
    isRefetching: holdingsRefetching,
  } = useFetchPortfolio();
  const {
    data: invitations,
    isLoading: invitesLoading,
    isError: invitesError,
    error: invitesErr,
    refetch: refetchInvites,
    isRefetching: invitesRefetching,
  } = useFetchInvitations();

  const holdingsList = holdings ?? [];
  const invitationsList = invitations ?? [];

  const active = useMemo(() => holdingsList.filter((h) => h.status === 'active'), [holdingsList]);
  const completed = useMemo(
    () => holdingsList.filter((h) => h.status === 'completed'),
    [holdingsList],
  );
  const stats = useMemo(() => computePortfolioStats(holdingsList), [holdingsList]);

  const segments = [
    { key: 'active', label: 'Active', count: active.length },
    { key: 'completed', label: 'Completed', count: completed.length },
    { key: 'invitations', label: 'Invitations', count: invitationsList.length },
  ];

  const showingInvites = filter === 'invitations';
  const listData = showingInvites ? invitationsList : filter === 'active' ? active : completed;
  const isLoading = holdingsLoading || invitesLoading;
  const isRefetching = holdingsRefetching || invitesRefetching;

  const handleRefresh = () => {
    refetchHoldings();
    refetchInvites();
  };

  if (isLoading) return <Spinner />;

  if (holdingsError && invitesError) {
    return (
      <EmptyState
        title="Could not load portfolio"
        message={holdingsErr?.message ?? invitesErr?.message}
        actionLabel="Retry"
        onAction={() => {
          void refetchHoldings();
          void refetchInvites();
        }}
      />
    );
  }

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Portfolio</Text>
      <PortfolioCard
        variant="portfolio"
        portfolioValueKobo={stats.portfolioValueKobo}
        investedKobo={stats.investedKobo}
        projectedProfitKobo={stats.projectedProfitKobo}
        realisedProfitKobo={stats.realisedProfitKobo}
        pnlBps={stats.pnlBps}
        totalUnitsHeld={stats.totalUnitsHeld}
        profitSharePct={stats.effectiveProfitSharePct}
        investorPoolPct={stats.investorPoolPct}
        projectCapitalKobo={stats.totalProjectCapitalKobo}
      />
      <View style={styles.chipWrap}>
        <ChipRow
          chips={segments}
          activeKey={filter}
          onChange={(k) => setFilter(k as PortfolioFilter)}
          ariaLabel="Portfolio filter"
        />
      </View>
      {showingInvites ? (
        <FlatList
          data={invitationsList}
          style={listFillStyle}
          scrollEnabled={listScrollEnabled}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <InviteProjectCard
              invite={item}
              onPress={() => router.push(investorProjectHref(item.projectId, item.id))}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: palette.muted }]}>No invitations</Text>
          }
        />
      ) : (
        <FlatList
          data={listData as typeof active}
          style={listFillStyle}
          scrollEnabled={listScrollEnabled}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <InvestmentCard
              entry={item}
              onPress={() => router.push(investorProjectHref(item.projectId, item.id))}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: palette.muted }]}>
              No investments in this category
            </Text>
          }
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: typography.families.display,
    fontSize: 32,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.6,
    marginBottom: spacing.sm,
  },
  chipWrap: {
    marginBottom: spacing.md,
  },
  list: { paddingBottom: scrollBottomInset },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sizes.sm },
});
