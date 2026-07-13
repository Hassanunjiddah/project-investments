import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { SITE_NAME } from '@/src/constants/site';

type Props = {
  userName?: string;
  notificationCount?: number;
  onNotificationPress?: () => void;
};

function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || 'U';
}

export function AppHeader({
  userName = 'User',
  notificationCount = 0,
  onNotificationPress,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const router = useRouter();

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <View style={[styles.logoIcon, { backgroundColor: palette.primary }]}>
          <Ionicons name="wallet-outline" size={16} color="#FFF" />
        </View>
        <Text style={[styles.brandText, { color: palette.primary }]}>{SITE_NAME}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={onNotificationPress} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={22} color={palette.text} />
          {notificationCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: palette.primary }]}>
              <Text style={styles.badgeText}>
                {notificationCount > 9 ? '9+' : notificationCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          style={[styles.avatar, { backgroundColor: palette.primaryLight }]}
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
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { position: 'relative', padding: 4 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
