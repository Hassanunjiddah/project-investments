import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { SectionHeader } from '@/src/components/ui/SectionHeader';
import { relativeTime } from '@/src/utils/date';
import type { Notification, NotificationType } from '@/src/services/notifications.services';
import { navigateNotificationHref } from '@/src/utils/navigateNotification';

/** Events that should surface on Home → Recent Updates with priority. */
const PRIORITY_TYPES = new Set<NotificationType>([
  'new-message',
  'activity-post',
  'declaration-pending',
  'declaration-approved',
  'declaration-rejected',
  'notice-minted',
  'proof-submitted',
  'project-pending',
  'project-approved',
  'project-rejected',
]);

type Props = {
  items: Notification[];
  limit?: number;
};

/**
 * Home "Recent Updates" — messages, profits, withdrawals, drawdowns, posts.
 */
export function RecentUpdatesSection({ items, limit = 6 }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();

  const updates = items.filter((n) => PRIORITY_TYPES.has(n.type)).slice(0, limit);

  return (
    <View>
      <SectionHeader
        title="Recent Updates"
        count={updates.length > 0 ? updates.length : undefined}
        actionLabel={updates.length > 0 ? 'All' : undefined}
        onAction={
          updates.length > 0
            ? () => router.navigate('/(tabs)/notifications' as never)
            : undefined
        }
      />
      {updates.length === 0 ? (
        <Text style={[styles.empty, { color: palette.muted }]}>No recent updates</Text>
      ) : (
        updates.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => navigateNotificationHref(router, item.href)}
            style={[
              styles.row,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
            accessibilityRole="button"
            testID={`recent-update-${item.id}`}
          >
            <View
              style={[
                styles.icon,
                { backgroundColor: palette.brand[50], borderColor: palette.border },
              ]}
            >
              <Feather name={item.icon as never} size={16} color={palette.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.message, { color: palette.textSecondary }]} numberOfLines={2}>
                {item.message}
              </Text>
            </View>
            <Text style={[styles.time, { color: palette.muted }]}>
              {relativeTime(item.createdAt)}
            </Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    textAlign: 'center',
    marginBottom: spacing.md,
    fontSize: typography.sizes.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  message: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: spacing.xs,
  },
});
