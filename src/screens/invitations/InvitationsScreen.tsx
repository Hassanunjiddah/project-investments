import { FlatList, Text, RefreshControl, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { formatNaira } from '@/src/utils/currency';
import { INVITE_STATUS_LABELS } from '@/src/types/invitation.types';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { investorProjectHref } from '@/src/helpers/routing';
import { listFillStyle, listScrollEnabled } from '@/src/constants/layout';

export default function InvitationsScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data, isLoading, isError, error, refetch, isRefetching } = useFetchInvitations();

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <EmptyState
        title="Could not load invitations"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const invitations = data ?? [];

  return (
    <ScreenLayout>
      <Text style={[styles.heading, { color: palette.text }]}>Invitations</Text>
      <FlatList
        data={invitations}
        style={listFillStyle}
        scrollEnabled={listScrollEnabled}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState
            title="No invitations"
            message="Investment invitations from line managers will appear here."
          />
        }
        renderItem={({ item }) => (
          <Card
            onPress={() =>
              router.push(investorProjectHref(item.projectId, item.id))
            }
          >
            <Text style={[styles.projectName, { color: palette.text }]}>
              {item.projectName ?? item.projectId}
            </Text>
            <Badge label={INVITE_STATUS_LABELS[item.status]} variant="accent" />
            {item.minUnits != null && item.amountMinor == null ? (
              <Text style={[styles.amount, { color: palette.textSecondary }]}>
                Min: {item.minUnits} unit{item.minUnits === 1 ? '' : 's'}
              </Text>
            ) : item.maxInvestmentAmountMinor != null && item.amountMinor == null ? (
              <Text style={[styles.amount, { color: palette.textSecondary }]}>
                Max: {formatNaira(item.maxInvestmentAmountMinor)}
              </Text>
            ) : null}
            {item.amountMinor != null ? (
              <Text style={[styles.amount, { color: palette.textSecondary }]}>
                Amount: {formatNaira(item.amountMinor)}
              </Text>
            ) : null}
            {item.projectedProfitMinor != null ? (
              <Text style={[styles.profit, { color: palette.primary }]}>
                Projected profit: {formatNaira(item.projectedProfitMinor)}
              </Text>
            ) : null}
          </Card>
        )}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  projectName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  amount: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  profit: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});
