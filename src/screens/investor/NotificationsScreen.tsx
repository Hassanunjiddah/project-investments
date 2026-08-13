import { FlatList, StyleSheet, RefreshControl, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { SkeletonCard } from '@/src/components/ui/Skeleton';
import { colors } from '@/src/constants/colors';
import { typography } from '@/src/constants/typography';
import { spacing, radii } from '@/src/constants/spacing';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { useAuthStore } from '@/src/store/useAuthStore';
import { navigateNotificationHref } from '@/src/utils/navigateNotification';

export default function NotificationsScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const { items, isLoading, refetch, isRefetching, markRead, lastReadAt } = useNotifications();

  // Mark all read once, on first non-loading render — avoids the refetch loop
  // that firing markRead() on every focus produces.
  useEffect(() => {
    if (!isLoading) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);


  const emptyMessage =
    role === 'PROJECT_OWNER'
      ? 'Drawdown decisions, profit updates, and messages from Prism appear here.'
      : role === 'LINE_MANAGER'
        ? 'Payment proofs, owner proposals, drawdown requests, and investor messages appear here.'
        : role === 'CEO' || role === 'ADMIN'
          ? 'Project submissions, profit declarations awaiting approval, and team alerts appear here.'
          : 'Invitations, payment confirmations, distribution notices, and project updates appear here.';

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>

      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="All caught up"
          message={emptyMessage}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isUnread = item.createdAt > lastReadAt;
            return (
              <Pressable
                onPress={() => navigateNotificationHref(router, item.href)}
                style={[
                  styles.row,
                  {
                    borderColor: isUnread ? palette.primary : palette.border,
                    backgroundColor: isUnread ? palette.brand[50] : palette.surface,
                  },
                ]}
                testID={`notification-${item.id}`}
                // @ts-expect-error web-only testId dupes for playwright
                data-testid={`notification-${item.id}`}
              >
                <View
                  style={[
                    styles.iconTile,
                    { backgroundColor: palette.brand[100], borderColor: palette.border },
                  ]}
                >
                  <Feather name={item.icon as never} size={18} color={palette.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.rowTitle, { color: palette.text }]}>{item.title}</Text>
                  <Text style={[styles.rowMeta, { color: palette.textSecondary }]}>
                    {item.message}
                  </Text>
                  {item.reference ? (
                    <Text style={[styles.ref, { color: palette.textSecondary }]}>
                      {item.reference}
                    </Text>
                  ) : null}
                </View>
                {isUnread ? <View style={[styles.dot, { backgroundColor: palette.primary }]} /> : null}
                <Feather name="chevron-right" size={16} color={palette.muted} />
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
    fontFamily: typography.families.display,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowMeta: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  ref: {
    fontFamily: typography.families.mono,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
});
