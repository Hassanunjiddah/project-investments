import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useSignOut } from '@/src/hooks/auth/useSignOut';
import { SITE_NAME } from '@/src/constants/site';

/** Desktop breakpoint — matches the tabs layout `useDesktop` hook. */
export const DESKTOP_BREAKPOINT = 960;

type RailItem = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  href: string;
  roles?: Array<'ceo' | 'manager' | 'investor'>;
  /** Show a live pulse dot when > 0. */
  badge?: number;
};

/**
 * DesktopLeftRail — Prism Capital's Ramp/Linear/Mercury-style navigation
 * rail rendered on ≥ 960px viewports. Renders only via a Platform + width
 * check; on mobile / narrow tablets returns `null` and the standard
 * bottom tab bar remains.
 *
 * Positioned as a fixed 240px column at the far-left of the viewport
 * with scroll-independent behaviour. Consuming layouts must add
 * `paddingLeft: 240` on the same breakpoint via `useDesktopShellInset()`.
 */
export function DesktopLeftRail({ pendingApprovals = 0 }: { pendingApprovals?: number }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const pathname = usePathname();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const user = useAuthStore((s) => s.user);
  const signOutMutation = useSignOut();

  if (!isDesktop || Platform.OS !== 'web') return null;

  const role = user?.role ?? null;
  const isCeo = role === 'CEO' || role === 'ADMIN';
  const isManager = role === 'LINE_MANAGER';
  const isInvestor = role === 'INVESTOR';

  const items: RailItem[] = [
    { key: 'dashboard', label: 'Dashboard',   icon: 'grid',           href: '/(tabs)/dashboard',       roles: ['ceo'] },
    { key: 'home',      label: 'Home',        icon: 'home',           href: '/(tabs)/home',            roles: ['manager', 'investor'] },
    { key: 'portfolio', label: 'Portfolio',   icon: 'briefcase',      href: '/(tabs)/portfolio',       roles: ['investor'] },
    { key: 'projects',  label: 'Projects',    icon: 'layers',         href: '/(tabs)/projects',        roles: ['ceo', 'manager'] },
    { key: 'approvals', label: 'Approvals',   icon: 'check-square',   href: '/(tabs)/approvals',       roles: ['ceo'], badge: pendingApprovals },
    { key: 'earnings',  label: 'Earnings',    icon: 'trending-up',    href: '/(tabs)/earnings',        roles: ['manager'] },
    { key: 'invitations', label: 'Invitations', icon: 'mail',         href: '/(tabs)/invitations',     roles: ['manager'] },
    { key: 'statements', label: 'Statements', icon: 'file-text',      href: '/(tabs)/statements',      roles: ['investor'] },
    { key: 'users',     label: 'Users',       icon: 'users',          href: '/(tabs)/users',           roles: ['ceo'] },
    { key: 'notifications', label: 'Notifications', icon: 'bell',     href: '/(tabs)/notifications',   roles: ['ceo', 'manager', 'investor'] },
    { key: 'profile',   label: 'Profile',     icon: 'user',           href: '/(tabs)/profile',         roles: ['ceo', 'manager', 'investor'] },
  ];

  const visible = items.filter((it) => {
    if (!it.roles) return true;
    if (isCeo && it.roles.includes('ceo')) return true;
    if (isManager && it.roles.includes('manager')) return true;
    if (isInvestor && it.roles.includes('investor')) return true;
    return false;
  });

  const activeKey = deriveActiveKey(pathname);

  return (
    <View
      // @ts-expect-error web-only fixed positioning — we render only on web
      style={[styles.rail, { backgroundColor: palette.surface, borderRightColor: palette.border, position: 'fixed' }]}
    >
      {/* Brand block */}
      <View style={styles.brand}>
        <img
          src="/images/prism-logo-512.png"
          alt="Prism Capital logo"
          width={28}
          height={24}
          style={{ objectFit: 'contain', display: 'block' }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.brandText, { color: palette.text }]}>{SITE_NAME}</Text>
          <Text style={[styles.brandRole, { color: palette.textSecondary }]}>
            {isCeo ? 'CEO workspace' : isManager ? 'Line Manager' : isInvestor ? 'Investor' : 'Signed in'}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: palette.border }]} />

      {/* Nav list */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {visible.map((it) => {
          const active = it.key === activeKey;
          return (
            <Pressable
              key={it.key}
              onPress={() => router.push(it.href as any)}
              accessibilityRole="link"
              accessibilityLabel={it.label}
              accessibilityState={{ selected: active }}
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
              <Feather name={it.icon} size={18} color={active ? palette.brand[700] : palette.textSecondary} />
              <Text
                style={[
                  styles.itemLabel,
                  {
                    color: active ? palette.brand[700] : palette.textSecondary,
                    fontWeight: active ? '600' : '500',
                  },
                ]}
              >
                {it.label}
              </Text>
              {it.badge && it.badge > 0 ? (
                <View style={[styles.itemBadge, { backgroundColor: palette.semantic.warning.bg, borderColor: palette.semantic.warning.border }]}>
                  <Text style={[styles.itemBadgeText, { color: palette.semantic.warning.fg }]}>
                    {it.badge > 99 ? '99+' : it.badge}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Footer: sign-out + version */}
      <View style={[styles.divider, { backgroundColor: palette.border }]} />
      <View style={styles.footer}>
        <Pressable
          onPress={() => signOutMutation.mutate()}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
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
  );
}

/** True when the current viewport is wide enough for the desktop shell. */
export function useDesktopShell() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

/**
 * Right padding that a screen must add to keep its content clear of the
 * fixed left rail. Screens can add this to their container styles.
 */
export function useDesktopShellInset() {
  const isDesktop = useDesktopShell();
  return isDesktop ? 240 : 0;
}

// -----------------------------------------------------------------------
function deriveActiveKey(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'dashboard';
  if (pathname.includes('/portfolio')) return 'portfolio';
  if (pathname.includes('/projects')) return 'projects';
  if (pathname.includes('/approvals')) return 'approvals';
  if (pathname.includes('/earnings')) return 'earnings';
  if (pathname.includes('/invitations')) return 'invitations';
  if (pathname.includes('/statements')) return 'statements';
  if (pathname.includes('/users')) return 'users';
  if (pathname.includes('/notifications')) return 'notifications';
  if (pathname.includes('/profile')) return 'profile';
  if (pathname.includes('/home')) return 'home';
  return '';
}

const styles = StyleSheet.create({
  rail: {
    top: 0,
    left: 0,
    bottom: 0,
    width: 240,
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
    // @ts-expect-error web-only
    transitionProperty: 'background-color',
    transitionDuration: '140ms',
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
