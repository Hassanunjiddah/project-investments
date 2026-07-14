import { useMemo, useState } from 'react';
import { FlatList, Text, StyleSheet, RefreshControl } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { SegmentedControl } from '@/src/components/ui/SegmentedControl';
import { PortfolioCard } from '@/src/components/ui/PortfolioCard';
import { InvestmentCard } from '@/src/components/investor/InvestmentCard';
import { InviteProjectCard } from '@/src/components/investor/InviteProjectCard';
import { Spinner } from '@/src/components/ui/Spinner';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { computePortfolioStats } from '@/src/services/portfolio.services';

type PortfolioFilter = 'active' | 'completed' | 'invitations';

export default function InvestorPortfolioScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [filter, setFilter] = useState<PortfolioFilter>('active');

  const {
    data: holdings = [],
    isLoading: holdingsLoading,
    refetch: refetchHoldings,
    isRefetching: holdingsRefetching,
  } = useFetchPortfolio();
  const {
    data: invitations = [],
    isLoading: invitesLoading,
    refetch: refetchInvites,
    isRefetching: invitesRefetching,
  } = useFetchInvitations();

  const active = useMemo(() => holdings.filter((h) => h.status === 'active'), [holdings]);
  const completed = useMemo(() => holdings.filter((h) => h.status === 'completed'), [holdings]);
  const stats = useMemo(() => computePortfolioStats(holdings), [holdings]);

  const segments = [
    { key: 'active', label: `Active (${active.length})` },
    { key: 'completed', label: `Completed (${completed.length})` },
    { key: 'invitations', label: `Invitations (${invitations.length})` },
  ];

  const showingInvites = filter === 'invitations';
  const listData = showingInvites ? invitations : filter === 'active' ? active : completed;
  const isLoading = holdingsLoading || invitesLoading;
  const isRefetching = holdingsRefetching || invitesRefetching;

  const handleRefresh = () => {
    refetchHoldings();
    refetchInvites();
  };

  if (isLoading) return <Spinner />;

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Portfolio</Text>
      <PortfolioCard
        variant="portfolio"
        portfolioValueKobo={stats.portfolioValueKobo}
        investedKobo={stats.investedKobo}
        projectedProfitKobo={stats.projectedProfitKobo}
        realisedProfitKobo={stats.realisedProfitKobo}
      />
      <SegmentedControl
        segments={segments}
        activeKey={filter}
        onChange={(k) => setFilter(k as PortfolioFilter)}
      />
      {showingInvites ? (
        <FlatList
          data={invitations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <InviteProjectCard
              invite={item}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/portfolio/projects/[id]',
                  params: { id: item.projectId, invite: item.id },
                })
              }
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: palette.muted }]}>No invitations</Text>
          }
        />
      ) : (
        <FlatList
          data={listData as typeof active}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <InvestmentCard
              entry={item}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/portfolio/projects/[id]',
                  params: { id: item.projectId },
                })
              }
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
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sizes.sm },
});
