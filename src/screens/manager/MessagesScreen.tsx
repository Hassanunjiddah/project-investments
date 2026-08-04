import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { AppHeader } from '@/src/components/ui/AppHeader';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, scrollBottomInset } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useMessageThreads } from '@/src/hooks/messages/useMessages';
import { relativeTime } from '@/src/utils/date';

/**
 * MessagesScreen — thread list for both Investor and Line Manager roles.
 * Each row shows counterparty name, project name, last preview, timestamp,
 * and an unread badge sourced from the DB `*_unread_count` columns.
 */
export default function MessagesScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: threads = [], isPending, isRefetching, refetch } = useMessageThreads();

  const renderItem = ({ item }: { item: (typeof threads)[number] }) => {
    const isCounterparty =
      user?.id === item.investorId || user?.id === item.ownerId;
    const unread = isCounterparty ? item.investorUnreadCount : item.managerUnreadCount;
    return (
      <Pressable
        onPress={() => router.push(`/(tabs)/messages/${item.id}` as any)}
        style={[
          styles.row,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
        accessibilityRole="button"
        data-testid={`thread-row-${item.id}`}
        testID={`thread-row-${item.id}`}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: palette.primaryLight },
          ]}
        >
          <Text style={[styles.avatarInitials, { color: palette.primary }]}>
            {(item.counterpartyName ?? '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
              {item.counterpartyName ?? 'Unknown'}
            </Text>
            {item.lastMessageAt ? (
              <Text style={[styles.time, { color: palette.textSecondary }]}>
                {relativeTime(new Date(item.lastMessageAt))}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.project, { color: palette.textSecondary }]} numberOfLines={1}>
            {item.projectName ?? 'Project'}
          </Text>
          <Text style={[styles.preview, { color: palette.text }]} numberOfLines={1}>
            {item.lastMessagePreview ?? 'No messages yet.'}
          </Text>
        </View>
        {unread > 0 ? (
          <View
            style={[
              styles.unread,
              { backgroundColor: palette.primary },
            ]}
          >
            <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={palette.textSecondary} />
      </Pressable>
    );
  };

  return (
    <ScreenLayout>
      <AppHeader userName={user?.fullName ?? 'You'} notificationCount={0} />
      <Text
        style={{
          fontFamily: typography.families.display,
          fontSize: 32,
          fontWeight: '600',
          color: palette.text,
          marginBottom: 4,
        }}
      >
        Messages
      </Text>
      <Text
        style={{
          fontSize: typography.sizes.sm,
          color: palette.textSecondary,
          marginBottom: spacing.md,
        }}
      >
        Your project conversations.
      </Text>
      {isPending ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={palette.primary} />
      ) : threads.length === 0 ? (
        <EmptyState
          icon="message-square"
          title="No conversations yet"
          message="Once you or your line manager sends a message on a project, it'll appear here."
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: scrollBottomInset, paddingTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
  },
  time: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.sm,
  },
  project: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginBottom: 2,
  },
  preview: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  unread: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  unreadText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
