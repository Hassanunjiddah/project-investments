import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { Component, type ReactNode } from 'react';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useSignOut } from '@/src/hooks/auth/useSignOut';
import { useNotifications } from '@/src/hooks/notifications/useNotifications';
import { SITE_NAME } from '@/src/constants/site';
import { RAIL_WIDTH, useIsDesktop } from '@/src/constants/layout';

type RailItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  href: string;
  roles?: ('ceo' | 'manager' | 'investor' | 'owner')[];
  badge?: number;
};

/** Isolate rail crashes so the rest of the desktop shell still paints. */
class RailErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/**
 * Desktop left nav (≥ 960px). Absolutely positioned inside the tabs shell —
 * avoid `position: fixed` on RN-web (it has blanked the viewport in desktop
 * browsers while the same session worked on phone).
 */
export function DesktopLeftRail({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const user = useAuthStore((s) => s.user);
  const storeRole = useAuthStore((s) => s.role);
  const signOutMutation = useSignOut();
  const { unreadCount } = useNotifications();

  if (!isDesktop) return null;

  const role = user?.role ?? storeRole;
  const isCeo = role === 'CEO' || role === 'ADMIN';
  const isManager = role === 'LINE_MANAGER';
  const isInvestor = role === 'INVESTOR';
  const isOwner = role === 'PROJECT_OWNER';

  // Plain paths (not `/(tabs)/…`) so tab navigation flips the active scene.
  const items: RailItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid', href: '/dashboard', roles: ['ceo'] },
    {
      key: 'home',
      label: isOwner ? 'Dashboard' : 'Home',
      icon: 'home',
      href: '/home',
      roles: ['manager', 'investor', 'owner'],
    },
    { key: 'portfolio', label: 'Portfolio', icon: 'briefcase', href: '/portfolio', roles: ['investor'] },
    { key: 'explore', label: 'Explore', icon: 'compass', href: '/explore', roles: ['investor'] },
    { key: 'projects', label: 'Projects', icon: 'layers', href: '/projects', roles: ['ceo', 'manager', 'owner'] },
    {
      key: 'approvals',
      label: 'Approvals',
      icon: 'check-square',
      href: '/approvals',
      roles: ['ceo'],
      badge: pendingApprovals,
    },
    { key: 'tasks', label: 'Tasks', icon: 'check-circle', href: '/tasks', roles: ['manager', 'ceo'] },
    { key: 'earnings', label: 'Earnings', icon: 'trending-up', href: '/earnings', roles: ['manager'] },
    {
      key: 'messages',
      label: 'Messages',
      icon: 'message-circle',
      href: '/messages',
      roles: ['manager', 'investor', 'owner'],
    },
    { key: 'statements', label: 'Statements', icon: 'file-text', href: '/statements', roles: ['investor'] },
    { key: 'users', label: 'Users', icon: 'users', href: '/users', roles: ['ceo'] },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: 'bell',
      href: '/notifications',
      roles: ['ceo', 'manager', 'investor', 'owner'],
      badge: unreadCount,
    },
    {
      key: 'profile',
      label: 'Profile',
      icon: 'user',
      href: '/profile',
      roles: ['ceo', 'manager', 'investor', 'owner'],
    },
  ];

  const visible = items.filter((it) => {
    if (!it.roles) return true;
    if (isCeo && it.roles.includes('ceo')) return true;
    if (isManager && it.roles.includes('manager')) return true;
    if (isInvestor && it.roles.includes('investor')) return true;
    if (isOwner && it.roles.includes('owner')) return true;
    return false;
  });

  const activeKey = deriveActiveKey(pathname);

  return (
    <RailErrorBoundary>
      <View
        style={[
          styles.rail,
          { backgroundColor: palette.surface, borderRightColor: palette.border },
          Platform.OS === 'web' ? ({ height: '100%', maxHeight: '100vh' } as object) : null,
        ]}
      >
        <View style={styles.brand}>
          {Platform.OS === 'web' ? (
            <img
              src="/images/prism-logo-512.png"
              alt="Prism Capital logo"
              width={28}
              height={24}
              style={{ objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <Feather name="triangle" size={22} color={palette.primary} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.brandText, { color: palette.text }]}>{SITE_NAME}</Text>
            <Text style={[styles.brandRole, { color: palette.textSecondary }]}>
              {isCeo
                ? 'CEO workspace'
                : isManager
                  ? 'Line Manager'
                  : isOwner
                    ? 'Project Owner'
                    : isInvestor
                      ? 'Investor'
                      : 'Signed in'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: palette.border }]} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {visible.map((it) => {
            const active = it.key === activeKey;
            return (
              <Pressable
                key={it.key}
                onPress={() => router.navigate(it.href as never)}
                accessibilityRole="link"
                accessibilityLabel={it.label}
                accessibilityState={{ selected: active }}
                // @ts-expect-error RN-web hover
                style={({ hovered }) => [
                  styles.item,
                  {
                    backgroundColor: active
                      ? palette.brand[50]
                      : hovered
                        ? palette.surfaceMuted
                        : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.itemPin,
                    { backgroundColor: active ? palette.primary : 'transparent' },
                  ]}
                />
                <Feather
                  name={it.icon}
                  size={18}
                  color={active ? palette.brand[700] : palette.textSecondary}
                />
                <Text
                  style={[
                    styles.itemLabel,
                    {
                      color: active ? palette.brand[700] : palette.textSecondary,
                      fontWeight: active ? '600' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {it.label}
                </Text>
                {it.badge && it.badge > 0 ? (
                  <View
                    style={[
                      styles.itemBadge,
                      {
                        backgroundColor: palette.semantic.warning.bg,
                        borderColor: palette.semantic.warning.border,
                      },
                    ]}
                  >
                    <Text style={[styles.itemBadgeText, { color: palette.semantic.warning.fg }]}>
                      {it.badge > 99 ? '99+' : it.badge}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.divider, { backgroundColor: palette.border }]} />
        <View style={styles.footer}>
          <Pressable
            onPress={() => signOutMutation.mutate()}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            // @ts-expect-error RN-web hover
            style={({ hovered }) => [
              styles.signOutRow,
              { backgroundColor: hovered ? palette.surfaceMuted : 'transparent' },
            ]}
          >
            <Feather name="log-out" size={16} color={palette.textSecondary} />
            <Text style={[styles.itemLabel, { color: palette.textSecondary, fontWeight: '500' }]}>
              Sign out
            </Text>
          </Pressable>
          <Text style={[styles.versionText, { color: palette.muted }]}>Institutional · v1.1</Text>
        </View>
      </View>
    </RailErrorBoundary>
  );
}

export function useDesktopShell() {
  return useIsDesktop();
}

export function useDesktopShellInset() {
  const isDesktop = useDesktopShell();
  return isDesktop ? RAIL_WIDTH : 0;
}

function deriveActiveKey(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'dashboard';
  if (pathname.includes('/portfolio')) return 'portfolio';
  if (pathname.includes('/explore')) return 'explore';
  if (pathname.includes('/projects')) return 'projects';
  if (pathname.includes('/approvals')) return 'approvals';
  if (pathname.includes('/tasks')) return 'tasks';
  if (pathname.includes('/earnings')) return 'earnings';
  if (pathname.includes('/invitations')) return 'invitations';
  if (pathname.includes('/messages')) return 'messages';
  if (pathname.includes('/statements')) return 'statements';
  if (pathname.includes('/users')) return 'users';
  if (pathname.includes('/notifications')) return 'notifications';
  if (pathname.includes('/profile')) return 'profile';
  if (pathname.includes('/home')) return 'home';
  return '';
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: RAIL_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    zIndex: 100,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  brandText: {
    fontFamily: typography.families.display,
    fontSize: 20,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  brandRole: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.3,
    marginTop: 1,
  },
  divider: {
    height: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.sm + 4,
    paddingBottom: spacing.md,
    gap: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    minHeight: 40,
    position: 'relative',
    // RN-web: keep icon + label on one row (anchors/flex quirks can stack them).
    ...(Platform.OS === 'web' ? ({ display: 'flex', flexDirection: 'row' } as object) : null),
  },
  itemPin: {
    position: 'absolute',
    left: -6,
    top: 12,
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  itemLabel: {
    fontSize: typography.sizes.sm,
    letterSpacing: -0.1,
    flex: 1,
  },
  itemBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 6,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    minHeight: 36,
  },
  versionText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.4,
    marginTop: 4,
  },
});
