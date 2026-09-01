import { useState } from 'react';
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
import {
  useEnsureMessageThread,
  useEnsureOwnerLmThread,
  useMessageableLineManagers,
  useMessageThreads,
} from '@/src/hooks/messages/useMessages';
import { relativeTime } from '@/src/utils/date';
import { isProjectOwner, isInvestor, isLineManager, canViewCeoDashboard } from '@/src/helpers/guards';
import type { MessageableLineManager } from '@/src/services/messages.services';

/**
 * MessagesScreen — thread list for Investor, Project Owner, Line Manager, and CEO.
 * Investors and owners also see every Line Manager they can message (per project)
 * so conversations can start from Messages, not only from a project page.
 * CEO/ADMIN see all project threads (oversight) but do not get an LM directory.
 */
export default function MessagesScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isCeo = canViewCeoDashboard(role);
  const { data: threads = [], isPending, isRefetching, refetch } = useMessageThreads();
  const showLmDirectory = isInvestor(role) || isProjectOwner(role);
  const {
    data: lineManagers = [],
    isPending: lmPending,
    refetch: refetchLms,
  } = useMessageableLineManagers();
  const ensureThread = useEnsureMessageThread();
  const ensureOwnerThread = useEnsureOwnerLmThread();
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  const emptyMessage = isCeo
    ? 'No project conversations yet.'
    : isLineManager(role)
      ? 'Open a project and message an investor or the project owner to start a conversation.'
      : isProjectOwner(role)
        ? 'Message your Prism Line Manager from the list below — conversations appear here.'
        : isInvestor(role)
          ? 'Message your line manager from the list below once a project invite is confirmed.'
          : 'Project conversations appear here.';

  const openExistingThread = (threadId: string) => {
    router.push(`/(tabs)/messages/${threadId}` as never);
  };

  const findExistingThread = (contact: MessageableLineManager) =>
    threads.find((t) => {
      if (t.projectId !== contact.projectId || t.managerId !== contact.managerId) return false;
      if (contact.kind === 'owner') return !!t.ownerId && !t.investorId;
      return !!t.investorId && !t.ownerId;
    });

  const handleOpenLineManager = async (contact: MessageableLineManager) => {
    const existing = findExistingThread(contact);
    if (existing) {
      openExistingThread(existing.id);
      return;
    }
    if (!user?.id) return;
    const key = `${contact.projectId}:${contact.managerId}`;
    setOpeningKey(key);
    try {
      const threadId =
        contact.kind === 'owner'
          ? await ensureOwnerThread.mutateAsync({ projectId: contact.projectId })
          : await ensureThread.mutateAsync({
              projectId: contact.projectId,
              investorId: user.id,
            });
      openExistingThread(threadId);
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Could not open the conversation.',
      });
    } finally {
      setOpeningKey(null);
    }
  };

  const renderThread = ({ item }: { item: (typeof threads)[number] }) => {
    const isCounterparty =
      user?.id === item.investorId || user?.id === item.ownerId;
    const unread = isCeo
      ? 0
      : isCounterparty
        ? item.investorUnreadCount
        : item.managerUnreadCount;
    const showRoleChip =
      (user?.id === item.managerId || isCeo) && (!!item.ownerId || !!item.investorId);
    return (
      <Pressable
        onPress={() => openExistingThread(item.id)}
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
            {showRoleChip ? (
              <Text
                style={[
                  styles.roleTag,
                  {
                    color: palette.primary,
                    backgroundColor: palette.primaryLight,
                  },
                ]}
              >
                {item.ownerId ? 'Owner' : 'Investor'}
              </Text>
            ) : null}
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

  const renderLmContact = ({ item }: { item: MessageableLineManager }) => {
    const key = `${item.projectId}:${item.managerId}`;
    const busy = openingKey === key;
    const hasThread = !!findExistingThread(item);
    return (
      <Pressable
        onPress={() => handleOpenLineManager(item)}
        disabled={busy}
        style={[
          styles.row,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Message ${item.managerName} about ${item.projectName}`}
        data-testid={`lm-contact-${item.projectId}`}
        testID={`lm-contact-${item.projectId}`}
      >
        <View style={[styles.avatar, { backgroundColor: palette.primaryLight }]}>
          <Text style={[styles.avatarInitials, { color: palette.primary }]}>
            {item.managerName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {item.managerName}
          </Text>
          <Text style={[styles.project, { color: palette.textSecondary }]} numberOfLines={1}>
            {item.projectName}
          </Text>
          <Text style={[styles.preview, { color: palette.textSecondary }]} numberOfLines={1}>
            {hasThread ? 'Open conversation' : 'Start a conversation'}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <View
            style={[
              styles.messageChip,
              { backgroundColor: palette.primaryLight },
            ]}
          >
            <Ionicons name="chatbubble-outline" size={14} color={palette.primary} />
            <Text style={[styles.messageChipText, { color: palette.primary }]}>Message</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const listHeader =
    showLmDirectory && (lmPending || lineManagers.length > 0) ? (
      <View style={styles.directory}>
        <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
          Your line managers
        </Text>
        {lmPending ? (
          <ActivityIndicator style={{ marginVertical: spacing.md }} color={palette.primary} />
        ) : (
          lineManagers.map((item) => (
            <View key={`${item.projectId}:${item.managerId}`} style={{ marginBottom: spacing.sm }}>
              {renderLmContact({ item })}
            </View>
          ))
        )}
        {threads.length > 0 ? (
          <Text
            style={[
              styles.sectionLabel,
              { color: palette.textSecondary, marginTop: spacing.md },
            ]}
          >
            Conversations
          </Text>
        ) : null}
      </View>
    ) : null;

  return (
    <ScreenLayout>
      <AppHeader userName={user?.fullName ?? 'You'} />
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
        {isProjectOwner(role)
          ? 'Your conversations with Prism Line Managers.'
          : isLineManager(role)
            ? 'Investor and project-owner conversations you mediate.'
            : 'Your project conversations and line managers.'}
      </Text>
      {isPending ? (
        <ActivityIndicator style={{ marginTop: spacing.lg }} color={palette.primary} />
      ) : threads.length === 0 &&
        !(showLmDirectory && (lmPending || lineManagers.length > 0)) ? (
        <EmptyState
          icon="message-square"
          title="No conversations yet"
          message={emptyMessage}
        />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={renderThread}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            showLmDirectory && lineManagers.length > 0 ? (
              <Text style={[styles.emptyHint, { color: palette.textSecondary }]}>
                Start a conversation with a line manager above.
              </Text>
            ) : null
          }
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={() => {
            refetch();
            if (showLmDirectory) void refetchLms();
          }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: scrollBottomInset, paddingTop: spacing.sm },
  directory: { marginBottom: spacing.sm },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontSize: typography.sizes.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
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
    flex: 1,
  },
  roleTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginLeft: 6,
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
  messageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
      borderRadius: radii.chip,
  },
  messageChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
});
