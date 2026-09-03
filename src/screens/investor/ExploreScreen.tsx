import { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { CategoryChips } from '@/src/components/ui/CategoryChips';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Spinner } from '@/src/components/ui/Spinner';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { ProgressBar } from '@/src/components/ui/ProgressBar';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { useFetchPortfolio } from '@/src/hooks/portfolio/useFetchPortfolio';
import { investorProjectHref } from '@/src/helpers/routing';
import { INVITE_STATUS_LABELS } from '@/src/types/invitation.types';
import { formatNaira } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing, scrollBottomInset } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

const SECTORS = ['All', 'Open invites', 'Active positions'];

/**
 * Investor explore — real invitations + portfolio holdings (no mock catalog).
 * Deep-links stay on the portfolio stack so AuthGuard never bounces.
 */
export default function ExploreScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState('All');

  const {
    data: invitations,
    isLoading: invitesLoading,
    isError: invitesError,
    error: invitesErr,
    refetch: refetchInvites,
    isRefetching: invitesRefetching,
  } = useFetchInvitations();
  const {
    data: holdings,
    isLoading: holdingsLoading,
    isError: holdingsError,
    error: holdingsErr,
    refetch: refetchHoldings,
    isRefetching: holdingsRefetching,
  } = useFetchPortfolio();

  const openInvites = useMemo(() => {
    const list = invitations ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((i) => i.status !== 'DECLINED' && i.status !== 'CONFIRMED')
      .filter((i) => {
        if (!q) return true;
        const hay = `${i.projectName ?? ''} ${i.projectId}`.toLowerCase();
        return hay.includes(q);
      });
  }, [invitations, query]);

  const activeHoldings = useMemo(() => {
    const list = (holdings ?? []).filter((h) => h.status === 'active');
    const q = query.trim().toLowerCase();
    return list.filter((h) => {
      if (!q) return true;
      return `${h.projectName ?? ''} ${h.projectId}`.toLowerCase().includes(q);
    });
  }, [holdings, query]);

  const showInvites = sector === 'All' || sector === 'Open invites';
  const showHoldings = sector === 'All' || sector === 'Active positions';

  if (invitesLoading && holdingsLoading) return <Spinner />;

  if (invitesError && holdingsError) {
    return (
      <EmptyState
        title="Could not load opportunities"
        message={invitesErr?.message ?? holdingsErr?.message}
        actionLabel="Retry"
        onAction={() => {
          void refetchInvites();
          void refetchHoldings();
        }}
      />
    );
  }

  const empty =
    (showInvites ? openInvites.length === 0 : true) &&
    (showHoldings ? activeHoldings.length === 0 : true);

  return (
    <ScreenLayout>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={invitesRefetching || holdingsRefetching}
            onRefresh={() => {
              void refetchInvites();
              void refetchHoldings();
            }}
          />
        }
      >
        <Text style={[styles.title, { color: palette.text }]}>Explore</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Your open invitations and active positions.
        </Text>
        <View
          style={[
            styles.searchRow,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={palette.muted} />
          <TextInput
            style={[styles.searchInput, { color: palette.text }]}
            placeholder="Search by project name"
            placeholderTextColor={palette.muted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        <CategoryChips categories={SECTORS} active={sector} onChange={setSector} />

        {showInvites ? (
          <>
            <SectionHeader title="Open invitations" />
            {openInvites.length === 0 ? (
              <Text style={[styles.emptyHint, { color: palette.muted }]}>
                No open invitations right now.
              </Text>
            ) : (
              openInvites.map((item) => (
                <Card
                  key={item.id}
                  onPress={() => router.push(investorProjectHref(item.projectId, item.id))}
                >
                  <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                    {item.projectName ?? 'Project'}
                  </Text>
                  <Badge label={INVITE_STATUS_LABELS[item.status]} variant="accent" />
                  {item.minUnits != null ? (
                    <Text style={[styles.meta, { color: palette.textSecondary }]}>
                      Min {item.minUnits} unit{item.minUnits === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                  {item.amountMinor != null ? (
                    <Text style={[styles.meta, { color: palette.textSecondary }]}>
                      {formatNaira(item.amountMinor)}
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </>
        ) : null}

        {showHoldings ? (
          <>
            <SectionHeader title="Active positions" />
            {activeHoldings.length === 0 ? (
              <Text style={[styles.emptyHint, { color: palette.muted }]}>
                No active holdings yet.
              </Text>
            ) : (
              activeHoldings.map((h) => {
                const progress = Math.min(100, Math.max(0, Math.round(h.progressPct ?? 0)));
                return (
                  <Card
                    key={h.id}
                    onPress={() => router.push(investorProjectHref(h.projectId))}
                  >
                    <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                      {h.projectName}
                    </Text>
                    <Text style={[styles.meta, { color: palette.textSecondary }]}>
                      Your stake: {formatNaira(h.capitalKobo)}
                    </Text>
                    <View style={styles.progressRow}>
                      <ProgressBar progress={progress} showLabel={false} />
                      <Text style={[styles.funded, { color: palette.textSecondary }]}>
                        {progress}% funded
                      </Text>
                    </View>
                  </Card>
                );
              })
            )}
          </>
        ) : null}

        {empty ? (
          <EmptyState
            title="Nothing to explore yet"
            message="When a Line Manager invites you to a raise, it will show up here."
          />
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: scrollBottomInset },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    height: 40,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: typography.sizes.sm },
  emptyHint: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  meta: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  funded: { fontSize: 10, minWidth: 56, textAlign: 'right' },
});
