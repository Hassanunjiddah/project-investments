import { useMemo, useState } from 'react';
import { ScrollView, Text, StyleSheet, RefreshControl, View } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { GreetingHeader } from '@/src/components/ui/GreetingHeader';
import { PortfolioCard } from '@/src/components/ui/PortfolioCard';
import { ActionPillGroup } from '@/src/components/ui/ActionPillGroup';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { PendingActionCard } from '@/src/components/investor/PendingActionCard';
import { PositionCard } from '@/src/components/investor/PositionCard';
import { ActivityDrawer } from '@/src/components/investor/ActivityDrawer';
import { Spinner } from '@/src/components/ui/Spinner';
import { colors } from '@/src/constants/colors';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { useLiveActivity } from '@/src/hooks/activity/useLiveActivity';
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

  // Live activity feed (Supabase realtime).
  const { events: activityEvents, unread, live, markAllRead } = useLiveActivity();
  const [activityOpen, setActivityOpen] = useState(false);

  const isLoading = holdingsLoading || invitesLoading;
  const isRefetching = holdingsRefetching || invitesRefetching;

  const handleRefresh = () => {
    refetchHoldings();
    refetchInvites();
  };

  if (isLoading) return <Spinner />;

  return (
    <ScreenLayout hideThemeToggle>
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
          pnlBps={portfolioStats.pnlBps}
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
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/portfolio/projects/[id]',
                  params: { id: action.projectId, invite: action.id },
                })
              }
            />
          ))
        )}

        <SectionHeader
          title="My Positions"
          count={holdings.length}
          actionLabel={holdings.length > 0 ? 'View all' : undefined}
          onAction={holdings.length > 0 ? () => router.push('/(tabs)/portfolio') : undefined}
        />
        {holdings.length === 0 ? (
          <Text style={[styles.empty, { color: palette.muted }]}>
            No positions yet — accept an invitation to get started.
          </Text>
        ) : (
          holdings.slice(0, 5).map((entry) => (
            <PositionCard
              key={entry.id}
              entry={entry}
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/portfolio/projects/[id]',
                  params: { id: entry.projectId, invite: entry.id },
                })
              }
            />
          ))
        )}

        <SectionHeader title="Recent Updates" />
        <Text style={[styles.empty, { color: palette.muted }]}>No recent updates</Text>
      </ScrollView>

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
