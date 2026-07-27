import { useEffect, useMemo, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
  Platform,
  Easing,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { EmptyState } from '@/src/components/ui/EmptyState';
import type { ActivityEvent } from '@/src/hooks/activity/useLiveActivity';

type Props = {
  visible: boolean;
  onClose: () => void;
  events: ActivityEvent[];
  onMarkAllRead?: () => void;
};

/**
 * ActivityDrawer — Prism Capital investor live-feed bottom sheet.
 *
 * Slides up from the bottom on both web and native. Backdrop tap
 * dismisses. Uses a native RN Modal for structure (correct focus
 * trapping + escape-key on web) with a custom Animated sheet inside.
 */
export function ActivityDrawer({ visible, onClose, events, onMarkAllRead }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();
  const translateY = useRef(new Animated.Value(600)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      // Clear the unread badge as soon as the drawer opens.
      onMarkAllRead?.();
    } else {
      translateY.setValue(600);
      opacity.setValue(0);
    }
  }, [visible, translateY, opacity, onMarkAllRead]);

  const grouped = useMemo(() => {
    // Simple two-bucket group: Today vs Earlier — enough for a drawer,
    // and predictable copy.
    const today: ActivityEvent[] = [];
    const earlier: ActivityEvent[] = [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    for (const e of events) {
      if (new Date(e.createdAt).getTime() >= startOfToday.getTime()) today.push(e);
      else earlier.push(e);
    }
    return { today, earlier };
  }, [events]);

  const handleEventTap = (event: ActivityEvent) => {
    onClose();
    if (event.href) {
      // Small delay so the sheet close animation reads before route change.
      setTimeout(() => router.push(event.href as any), 220);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          styles.backdrop,
          { opacity, backgroundColor: 'rgba(6, 79, 146, 0.35)' },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close activity feed" />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handleWrap} pointerEvents="none">
          <View style={[styles.handle, { backgroundColor: palette.border }]} />
        </View>

        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: palette.text }]}>Activity</Text>
            <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
              Live updates from your investments
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            style={({ hovered }) => [
              styles.closeBtn,
              { borderColor: palette.border, backgroundColor: hovered && Platform.OS === 'web' ? palette.surfaceMuted : palette.surface },
            ]}
          >
            <Feather name="x" size={18} color={palette.text} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {events.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                title="Nothing new yet"
                message="When invites, payments or distributions land, you'll see them here in real time."
              />
            </View>
          ) : (
            <>
              {grouped.today.length > 0 ? (
                <>
                  <SectionLabel text="Today" palette={palette} />
                  {grouped.today.map((e) => (
                    <ActivityRow key={e.id} event={e} palette={palette} onPress={() => handleEventTap(e)} />
                  ))}
                </>
              ) : null}
              {grouped.earlier.length > 0 ? (
                <>
                  <SectionLabel text="Earlier" palette={palette} />
                  {grouped.earlier.map((e) => (
                    <ActivityRow key={e.id} event={e} palette={palette} onPress={() => handleEventTap(e)} />
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// -----------------------------------------------------------------------
function SectionLabel({ text, palette }: { text: string; palette: any }) {
  return (
    <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>{text}</Text>
  );
}

function ActivityRow({
  event,
  palette,
  onPress,
}: {
  event: ActivityEvent;
  palette: any;
  onPress: () => void;
}) {
  const meta = ICON_MAP[event.kind];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed, hovered }) => [
        styles.row,
        {
          backgroundColor: hovered && Platform.OS === 'web' ? palette.brand[50] : palette.surface,
          borderColor: palette.border,
          transform: pressed ? [{ scale: 0.995 }] : undefined,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={event.title}
    >
      <View
        style={[
          styles.iconTile,
          { backgroundColor: palette.semantic[meta.tone].bg, borderColor: palette.semantic[meta.tone].border },
        ]}
      >
        <Feather name={meta.icon} size={16} color={palette.semantic[meta.tone].fg} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={2}>
          {event.title}
        </Text>
        {event.subtitle ? (
          <Text style={[styles.rowSubtitle, { color: palette.textSecondary }]} numberOfLines={1}>
            {event.subtitle}
          </Text>
        ) : null}
      </View>
      <Feather name="chevron-right" size={16} color={palette.textSecondary} />
    </Pressable>
  );
}

const ICON_MAP: Record<
  ActivityEvent['kind'],
  { icon: React.ComponentProps<typeof Feather>['name']; tone: 'success' | 'info' | 'warning' | 'danger' }
> = {
  distribution_posted:     { icon: 'trending-up', tone: 'success' },
  invite_ready_to_pledge:  { icon: 'mail',        tone: 'info' },
  invite_committed:        { icon: 'upload',      tone: 'warning' },
  invite_confirmed:        { icon: 'check-circle', tone: 'success' },
  invite_declined:         { icon: 'x-circle',    tone: 'danger' },
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    minHeight: 380,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    paddingBottom: spacing.lg,
    shadowColor: '#0A1F3D',
    shadowOpacity: 0.28,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: -8 },
    elevation: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: 4,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: typography.families.display,
    fontSize: 28,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: 6,
  },
  emptyWrap: { paddingTop: spacing.xl },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: 6,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    padding: spacing.sm + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    // @ts-expect-error web-only
    transitionProperty: 'background-color, transform',
    transitionDuration: '150ms',
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    letterSpacing: -0.1,
  },
  rowSubtitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});
