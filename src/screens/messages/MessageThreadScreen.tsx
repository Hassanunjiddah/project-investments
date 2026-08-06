import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useAuthStore } from '@/src/store/useAuthStore';
import {
  useMarkThreadRead,
  useMessageThreads,
  useMessagesRealtime,
  useSendMessage,
  useThreadMessages,
} from '@/src/hooks/messages/useMessages';
import { relativeTime } from '@/src/utils/date';

/**
 * MessageThreadScreen — 1:1 chat (investor↔LM or owner↔LM) on a project.
 * Live via `useMessagesRealtime()`.
 */
export default function MessageThreadScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = typeof id === 'string' ? id : '';
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList | null>(null);

  const { data: threads = [] } = useMessageThreads();
  const threadMeta = threads.find((t) => t.id === threadId);
  const headerTitle = threadMeta?.counterpartyName?.trim() || 'Conversation';
  const headerSubtitle = threadMeta?.projectName
    ? `${threadMeta.projectName}${threadMeta.ownerId ? ' · Project owner' : threadMeta.investorId ? ' · Investor' : ''}`
    : threadMeta?.ownerId
      ? 'Project owner conversation'
      : threadMeta?.investorId
        ? 'Investor conversation'
        : undefined;

  const { data: messages = [], isPending } = useThreadMessages(threadId);
  const sendMutation = useSendMessage(threadId);
  const markRead = useMarkThreadRead(threadId);
  useMessagesRealtime(threadId);

  // Mark the thread read once on open, and again whenever a new message
  // arrives while we're on-screen.
  useEffect(() => {
    if (threadId) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages.length]);

  // Auto-scroll to the bottom whenever the message list grows.
  useEffect(() => {
    if (!listRef.current) return;
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 60);
  }, [messages.length]);

  const onSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    try {
      await sendMutation.mutateAsync(body);
    } catch (err) {
      // Restore the draft so the user can retry.
      setDraft(body);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <View
        style={[
          styles.header,
          { borderBottomColor: palette.border, backgroundColor: palette.surface },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to messages"
          data-testid="thread-back-btn"
          testID="thread-back-btn"
        >
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>
            {headerTitle}
          </Text>
          {headerSubtitle ? (
            <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]} numberOfLines={1}>
              {headerSubtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {isPending ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={palette.primary} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id;
              return (
                <View
                  style={[
                    styles.bubbleRow,
                    { justifyContent: isMe ? 'flex-end' : 'flex-start' },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isMe
                        ? { backgroundColor: palette.primary, borderTopRightRadius: 4 }
                        : {
                            backgroundColor: palette.surface,
                            borderColor: palette.border,
                            borderWidth: 1,
                            borderTopLeftRadius: 4,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: isMe ? '#fff' : palette.text },
                      ]}
                    >
                      {item.body}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleTime,
                        {
                          color: isMe ? 'rgba(255,255,255,0.7)' : palette.textSecondary,
                        },
                      ]}
                    >
                      {relativeTime(new Date(item.createdAt))}
                    </Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View
          style={[
            styles.composer,
            { backgroundColor: palette.surface, borderTopColor: palette.border },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={palette.textSecondary}
            multiline
            style={[
              styles.input,
              { backgroundColor: palette.background, color: palette.text, borderColor: palette.border },
            ]}
            data-testid="composer-input"
            testID="composer-input"
          />
          <Pressable
            onPress={onSend}
            disabled={!draft.trim() || sendMutation.isPending}
            style={[
              styles.sendBtn,
              {
                backgroundColor: draft.trim() ? palette.primary : palette.border,
                opacity: sendMutation.isPending ? 0.6 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            data-testid="composer-send-btn"
            testID="composer-send-btn"
          >
            <Ionicons name="arrow-up" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.xs },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.families.display,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
    textAlign: 'center',
  },
  messagesList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.xs },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
  },
  bubbleText: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  bubbleTime: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 4,
    textAlign: 'right',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: radii.input,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
