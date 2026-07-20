import { FlatList, StyleSheet, RefreshControl, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Spinner } from '@/src/components/ui/Spinner';
import { colors } from '@/src/constants/colors';
import { typography } from '@/src/constants/typography';
import { spacing } from '@/src/constants/spacing';
import { useFetchInvitations } from '@/src/hooks/invitations/useFetchInvitations';
import { INVITE_STATUS_LABELS } from '@/src/types/invitation.types';
import { formatNaira } from '@/src/utils/currency';

export default function NotificationsScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();
  const { data: invites = [], isLoading, refetch, isRefetching } = useFetchInvitations();

  const openInvite = (inviteId: string, projectId: string) => {
    router.push(`/(tabs)/projects/${projectId}?invite=${inviteId}`);
  };

  const actionable = invites.filter((i) => i.status !== 'DECLINED');

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>

      {isLoading ? (
        <Spinner />
      ) : actionable.length === 0 ? (
        <EmptyState
          title="All caught up"
          message="Invitations, payment confirmations, and project updates will appear here."
        />
      ) : (
        <FlatList
          data={actionable}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isPending = item.status === 'INVITED' || item.status === 'ACCEPTED';
            return (
              <Pressable
                onPress={() => openInvite(item.id, item.projectId)}
                style={[
                  styles.row,
                  { borderColor: palette.border, backgroundColor: palette.surface },
                ]}
                data-testid={`notification-invite-${item.id}`}
              >
                <View
                  style={[
                    styles.iconTile,
                    { backgroundColor: isPending ? palette.primaryLight : palette.surface },
                  ]}
                >
                  <Ionicons
                    name={isPending ? 'mail-unread-outline' : 'checkmark-circle-outline'}
                    size={18}
                    color={palette.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: palette.text }]}>
                    {item.projectName ?? 'Project invitation'}
                  </Text>
                  <Text style={[styles.rowMeta, { color: palette.textSecondary }]}>
                    {INVITE_STATUS_LABELS[item.status]}
                    {item.maxInvestmentAmountMinor
                      ? ` · up to ${formatNaira(item.maxInvestmentAmountMinor)}`
                      : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={palette.muted} />
              </Pressable>
            );
          }}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  rowMeta: { fontSize: typography.sizes.xs },
});
