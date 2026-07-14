import { useMemo } from 'react';
import { ScrollView, Text, StyleSheet, RefreshControl } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { PortfolioCard } from '@/src/components/ui/PortfolioCard';
import { StatCard, StatGrid } from '@/src/components/ui/StatCard';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { PendingActionCard } from '@/src/components/investor/PendingActionCard';
import { Spinner } from '@/src/components/ui/Spinner';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { computePortfolioStats } from '@/src/services/portfolio.services';
import type { Invite, InviteStatus } from '@/src/types/invitation.types';
import type { PendingAction, PendingActionType } from '@/db/types/notification';

function inviteActionType(status: InviteStatus): PendingActionType {
  switch (status) {
    case 'INVITED':
      return 'review';
    case 'ACCEPTED':
      return 'payment';
    case 'COMMITTED':
    case 'PROOF_SUBMITTED':
      return 'upload_proof';
    default:
      return 'review';
  }
}

function inviteActionTitle(invite: Invite): string {
  const name = invite.projectName ?? 'a project';
  switch (invite.status) {
    case 'INVITED':
      return `Review invitation for ${name}`;
    case 'ACCEPTED':
      return `Commit investment for ${name}`;
    case 'COMMITTED':
      return `Upload payment proof for ${name}`;
    case 'PROOF_SUBMITTED':
      return `Awaiting confirmation for ${name}`;
    default:
      return `Open ${name}`;
  }
}

function mapInviteToPendingAction(invite: Invite, investorId: string): PendingAction {
  return {
    id: invite.id,
    type: inviteActionType(invite.status),
    title: inviteActionTitle(invite),
    projectId: invite.projectId,
    projectName: invite.projectName ?? 'Project',
    timeRemaining: invite.status === 'PROOF_SUBMITTED' ? 'Pending' : 'Action needed',
    investorId,
  };
}

export default function InvestorHomeScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const user = useAuthStore((s) => s.user);

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

  const portfolioStats = useMemo(() => computePortfolioStats(holdings), [holdings]);
  const activeInvestments = useMemo(
    () => holdings.filter((h) => h.status === 'active').length,
    [holdings],
  );
  const portfolioRoiPct = useMemo(() => {
    if (portfolioStats.investedKobo <= 0) return 0;
    return Math.round((portfolioStats.projectedProfitKobo / portfolioStats.investedKobo) * 1000) / 10;
  }, [portfolioStats]);

  const pendingActions = useMemo(
    () => invitations.map((inv) => mapInviteToPendingAction(inv, user?.id ?? '')),
    [invitations, user?.id],
  );

  const isLoading = holdingsLoading || invitesLoading;
  const isRefetching = holdingsRefetching || invitesRefetching;

  const handleRefresh = () => {
    refetchHoldings();
    refetchInvites();
  };

  if (isLoading) return <Spinner />;

  return (
    <ScreenLayout>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <AppHeader
          userName={user?.fullName ?? ''}
          notificationCount={pendingActions.length}
        />
        <GreetingHeader
          name={user?.fullName ?? ''}
          subtitle="Track your portfolio and pending actions."
        />

        <PortfolioCard
          portfolioValueKobo={portfolioStats.portfolioValueKobo}
          investedKobo={portfolioStats.investedKobo}
          projectedProfitKobo={portfolioStats.projectedProfitKobo}
          realisedProfitKobo={portfolioStats.realisedProfitKobo}
        />

        <StatGrid>
          <StatCard icon="pie-chart-outline" label="Active" value={String(activeInvestments)} />
          <StatCard icon="wallet-outline" label="Withdraw" value={formatNaira(0)} />
          <StatCard icon="trending-up-outline" label="ROI" value={`${portfolioRoiPct}%`} />
        </StatGrid>

        <SectionHeader
          title="Pending Actions"
          count={pendingActions.length}
          actionLabel="View all"
          onAction={() => router.push('/(tabs)/portfolio')}
        />
        {pendingActions.length === 0 ? (
          <Text style={[styles.empty, { color: palette.muted }]}>No pending actions</Text>
        ) : (
          pendingActions.map((action) => (
            <PendingActionCard
              key={action.id}
              action={action}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/portfolio/projects/[id]',
                  params: { id: action.projectId, invite: action.id },
                })
              }
            />
          ))
        )}

        <SectionHeader title="Recent Updates" />
        <Text style={[styles.empty, { color: palette.muted }]}>No recent updates</Text>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  empty: {
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: typography.sizes.sm,
  },
});
