import { useMemo, useState } from 'react';
import { Text, StyleSheet, RefreshControl, View } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { PageScroll } from '@/src/components/ui/PageScroll';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { PortfolioCard } from '@/src/components/ui/PortfolioCard';
import { ActionPillGroup } from '@/src/components/ui/ActionPillGroup';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { PendingActionCard } from '@/src/components/investor/PendingActionCard';
import { PositionCard } from '@/src/components/investor/PositionCard';
import { ActivityDrawer } from '@/src/components/investor/ActivityDrawer';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { useLiveActivity } from '@/src/hooks/activity/useLiveActivity';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { RecentUpdatesSection } from '@/src/components/nav/RecentUpdatesSection';
import { computePortfolioStats } from '@/src/services/portfolio.services';
import { investorProjectHref } from '@/src/helpers/routing';
import type { Invite, InviteStatus } from '@/src/types/invitation.types';
import type { PendingAction, PendingActionType } from '@/src/types/pendingAction.types';

function inviteActionType(status: InviteStatus): PendingActionType {
  switch (status) {
    case 'INVITED':
      return 'review';
    case 'ACCEPTED':
      return 'payment';
    case 'COMMITTED':
      return 'upload_proof';
    case 'PROOF_SUBMITTED':
      return 'awaiting_confirm';
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

  const portfolioStats = useMemo(() => computePortfolioStats(holdingsList), [holdingsList]);
  const activeInvestments = useMemo(
    () => holdingsList.filter((h) => h.status === 'active').length,
    [holdingsList],
  );
  const portfolioRoiPct = useMemo(() => {
    if (portfolioStats.investedKobo <= 0) return 0;
    return Math.round((portfolioStats.projectedProfitKobo / portfolioStats.investedKobo) * 1000) / 10;
  }, [portfolioStats]);

  const pendingActions = useMemo(
    () => invitationsList.map((inv) => mapInviteToPendingAction(inv, user?.id ?? '')),
    [invitationsList, user?.id],
  );

  // Live activity feed (Supabase realtime).
  const { events: activityEvents, unread, live, markAllRead } = useLiveActivity();
  const { items: notificationItems } = useNotifications();
  const [activityOpen, setActivityOpen] = useState(false);

  const isLoading = holdingsLoading || invitesLoading;
  const isRefetching = holdingsRefetching || invitesRefetching;

  const handleRefresh = () => {
    refetchHoldings();
    refetchInvites();
  };

  if (isLoading) return <Spinner />;

  const holdingsFailed = holdingsError && !holdingsList.length;
  const invitesFailed = invitesError && !invitationsList.length;

  if (holdingsFailed && invitesFailed) {
    return (
      <EmptyState
        title="Could not load your home"
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
    <ScreenLayout hideThemeToggle>
      <PageScroll
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />}
      >
        <AppHeader userName={user?.fullName ?? ''} />
        <GreetingHeader
          name={user?.fullName ?? ''}
          subtitle="Track your portfolio and pending actions."
        />

        <PortfolioCard
          portfolioValueKobo={portfolioStats.portfolioValueKobo}
          investedKobo={portfolioStats.investedKobo}
          projectedProfitKobo={portfolioStats.projectedProfitKobo}
          realisedProfitKobo={portfolioStats.realisedProfitKobo}
          pnlBps={portfolioStats.pnlBps}
          totalUnitsHeld={portfolioStats.totalUnitsHeld}
          profitSharePct={portfolioStats.effectiveProfitSharePct}
          investorPoolPct={portfolioStats.investorPoolPct}
          projectCapitalKobo={portfolioStats.totalProjectCapitalKobo}
        />

        <View style={styles.actionsWrap}>
          <ActionPillGroup
            actions={[
              {
                key: 'portfolio',
                label: 'Portfolio',
                icon: 'briefcase',
                primary: true,
                onPress: () => router.push('/(tabs)/portfolio'),
              },
              {
                key: 'invites',
                label: 'Invites',
                icon: 'mail',
                onPress: () => router.push('/(tabs)/portfolio'),
              },
              {
                key: 'statements',
                label: 'Statements',
                icon: 'file-text',
                onPress: () => router.push('/(tabs)/statements'),
              },
              {
                key: 'activity',
                label: unread > 0 ? `Activity · ${unread}` : 'Activity',
                icon: 'radio',
                onPress: () => setActivityOpen(true),
                testID: 'open-activity-drawer-btn',
                // Live-signal dot: green pulse when both realtime channels are
                // subscribed, muted grey when the socket is closed.
                dot: live
                  ? { color: palette.semantic.success.fg, pulse: true }
                  : { color: palette.muted, pulse: false },
              },
            ]}
          />
        </View>

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
              onPress={() => router.push(investorProjectHref(action.projectId, action.id))}
            />
          ))
        )}

        <SectionHeader
          title="My Positions"
          count={holdingsList.length}
          actionLabel={holdingsList.length > 0 ? 'View all' : undefined}
          onAction={holdingsList.length > 0 ? () => router.push('/(tabs)/portfolio') : undefined}
        />
        {holdingsList.length === 0 ? (
          <Text style={[styles.empty, { color: palette.muted }]}>
            No positions yet — accept an invitation to get started.
          </Text>
        ) : (
          holdingsList.slice(0, 5).map((entry) => (
            <PositionCard
              key={entry.id}
              entry={entry}
              onPress={() => router.push(investorProjectHref(entry.projectId, entry.id))}
            />
          ))
        )}

        <RecentUpdatesSection items={notificationItems} />
      </PageScroll>

      <ActivityDrawer
        visible={activityOpen}
        onClose={() => setActivityOpen(false)}
        events={activityEvents}
        onMarkAllRead={markAllRead}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset },
  actionsWrap: {
    marginBottom: spacing.md,
  },
  empty: {
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: typography.sizes.sm,
  },
});
