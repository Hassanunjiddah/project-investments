import { useMemo, useState } from 'react';
import { View, Text, TextInput, SectionList, StyleSheet, RefreshControl } from 'react-native';
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
import { listFillStyle, listScrollEnabled } from '@/src/constants/layout';

const SECTORS = ['All', 'Open invites', 'Active positions', 'Past investments'];

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

  const pastHoldings = useMemo(() => {
    const list = (holdings ?? []).filter((h) => h.status === 'completed');
    const q = query.trim().toLowerCase();
    return list.filter((h) => {
      if (!q) return true;
      return `${h.projectName ?? ''} ${h.projectId}`.toLowerCase().includes(q);
    });
  }, [holdings, query]);

  const showInvites = sector === 'All' || sector === 'Open invites';
  const showHoldings = sector === 'All' || sector === 'Active positions';
  const showPast = sector === 'All' || sector === 'Past investments';

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

  const sections = useMemo(() => {
    const out: { key: string; title: string; data: { id: string; kind: 'invite' | 'holding'; raw: unknown }[] }[] =
      [];
    if (showInvites) {
      out.push({
        key: 'invites',
        title: 'Open invitations',
        data: openInvites.map((item) => ({ id: item.id, kind: 'invite' as const, raw: item })),
      });
    }
    if (showHoldings) {
      out.push({
        key: 'holdings',
        title: 'Active positions',
        data: activeHoldings.map((h) => ({ id: h.id, kind: 'holding' as const, raw: h })),
      });
    }
    if (showPast) {
      out.push({
        key: 'past',
        title: 'Past investments',
        data: pastHoldings.map((h) => ({ id: h.id, kind: 'holding' as const, raw: h })),
      });
    }
    return out;
  }, [showInvites, showHoldings, showPast, openInvites, activeHoldings, pastHoldings]);

  const empty =
    (showInvites ? openInvites.length === 0 : true) &&
    (showHoldings ? activeHoldings.length === 0 : true);

  return (
    <ScreenLayout>
      <SectionList
        sections={sections}
        style={listFillStyle}
        scrollEnabled={listScrollEnabled}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.scroll}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={invitesRefetching || holdingsRefetching}
            onRefresh={() => {
              void refetchInvites();
              void refetchHoldings();
            }}
          />
        }
        ListHeaderComponent={
          <>
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
          </>
        }
        ListEmptyComponent={
          empty ? (
            <EmptyState
              title="Nothing to explore yet"
              message="When a Line Manager invites you to a raise, it will show up here."
            />
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <>
            <SectionHeader title={section.title} />
            {section.data.length === 0 ? (
              <Text style={[styles.emptyHint, { color: palette.muted }]}>
                {section.key === 'invites'
                  ? 'No open invitations right now.'
                  : 'No active holdings yet.'}
              </Text>
            ) : null}
          </>
        )}
        renderItem={({ item }) => {
          if (item.kind === 'invite') {
            const invite = item.raw as (typeof openInvites)[number];
            return (
              <Card onPress={() => router.push(investorProjectHref(invite.projectId, invite.id))}>
                <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                  {invite.projectName ?? 'Project'}
                </Text>
                <Badge label={INVITE_STATUS_LABELS[invite.status]} variant="accent" />
                {invite.minUnits != null ? (
                  <Text style={[styles.meta, { color: palette.textSecondary }]}>
                    Min {invite.minUnits} unit{invite.minUnits === 1 ? '' : 's'}
                  </Text>
                ) : null}
                {invite.amountMinor != null ? (
                  <Text style={[styles.meta, { color: palette.textSecondary }]}>
                    {formatNaira(invite.amountMinor)}
                  </Text>
                ) : null}
              </Card>
            );
          }
          const h = item.raw as (typeof activeHoldings)[number];
          const progress = Math.min(100, Math.max(0, Math.round(h.progressPct ?? 0)));
          return (
            <Card onPress={() => router.push(investorProjectHref(h.projectId, h.id))}>
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
        }}
      />
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
