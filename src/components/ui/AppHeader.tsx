import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { SITE_NAME } from '@/src/constants/site';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { useIsDesktop } from '@/src/constants/layout';

type Props = {
  userName?: string;
  /** Manual override — if omitted, uses the useNotifications() hook. */
  notificationCount?: number;
  /** Manual override — defaults to routing to /notifications. */
  onNotificationPress?: () => void;
};

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'U';
}

/**
 * Refined app header (Feb 2026): frosted glass strip on web, refined logo
 * mark, spacious action row. The theme toggle intentionally lives in
 * Profile → Appearance rather than here so it never blocks page-level CTAs
 * like "New Project".
 */
export function AppHeader({ userName = 'User', notificationCount, onNotificationPress }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const palette = colors[scheme];
  const router = useRouter();
  const isDark = scheme === 'dark';
  const notifications = useNotifications();
  const effectiveCount = notificationCount ?? notifications.unreadCount;
  const isDesktop = useIsDesktop();
  const handleBellPress =
    onNotificationPress ??
    (() => {
      router.push('/(tabs)/notifications' as never);
    });

  // Frosted glass background on web only — RN doesn't support backdrop-filter.
  const backdrop =
    Platform.OS === 'web'
      ? {
          backgroundColor: `rgba(${palette.surfaceRgb}, 0.75)`,
          // @ts-expect-error web-only CSS
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }
      : { backgroundColor: palette.surface };

  return (
    <View style={[styles.row, backdrop, { borderColor: palette.border }]}>
      {isDesktop ? (
        <View />
      ) : (
        <View style={styles.brand}>
          <View
            style={[
              styles.logoMark,
              { backgroundColor: palette.brand[50], borderColor: palette.brand[100] },
            ]}
          >
            {Platform.OS === 'web' ? (
              <img
                src="/images/prism-logo-512.png"
                alt="Prism Capital logo"
                width={24}
                height={20}
                style={{ objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <Ionicons name="triangle" size={18} color={colors[scheme].primary} />
            )}
          </View>
          <Text style={[styles.brandText, { color: palette.text }]}>{SITE_NAME}</Text>
        </View>
      )}
      <View style={styles.actions}>
        <Pressable
          onPress={toggleTheme}
          testID="theme-toggle-btn"
          accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name={isDark ? 'sun' : 'moon'} size={18} color={palette.text} />
        </Pressable>
        <Pressable
          onPress={handleBellPress}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: palette.surfaceMuted, opacity: pressed ? 0.7 : 1 },
          ]}
          accessibilityLabel="Notifications"
          testID="notifications-bell"
          // @ts-expect-error web-only
          data-testid="notifications-bell"
        >
          <Ionicons name="notifications-outline" size={18} color={palette.text} />
          {effectiveCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: palette.error }]}>
              <Text style={styles.badgeText}>{effectiveCount > 9 ? '9+' : effectiveCount}</Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [
            styles.avatar,
            {
              backgroundColor: palette.primaryLight,
              borderColor: palette.border,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityLabel="Profile"
        >
          <Text style={[styles.avatarText, { color: palette.primary }]}>
            {getInitial(userName)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 24,
    height: 20,
  },
  brandText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    letterSpacing: -0.3,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
