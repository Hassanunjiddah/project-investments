import { Tabs, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { isInvestor, canViewUsers, canViewCeoDashboard, isLineManager } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';
import { useStatsStore } from '@/src/store/useStatsStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { useIdleTimeout } from '@/src/hooks/auth/useIdleTimeout';
import { SessionExpiredModal } from '@/src/components/auth/SessionExpiredModal';
import { useSignOut } from '@/src/hooks/auth/useSignOut';
import { DesktopLeftRail } from '@/src/components/nav/DesktopLeftRail';
import { RAIL_WIDTH, useIsDesktop } from '@/src/constants/layout';

export default function TabLayout() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: profile } = useFetchProfile();
  // Auth-store role is source of truth. Never trust a cached profile from a
  // previous account — that painted LM/CEO shells for invited investors.
  const storeRole = useAuthStore((s) => s.role);
  const session = useAuthStore((s) => s.session);
  const sessionUserId = session?.user?.id ?? null;
  const profileMatchesSession = !!profile && !!sessionUserId && profile.id === sessionUserId;
  const role = storeRole ?? (profileMatchesSession ? profile.role : null);
  // While role hydrates, keep Home routable so we never land on a blank shell.
  // Do NOT expose manager/CEO tabs until role is known.
  const rolePending = !!session && !role;
  const investor = isInvestor(role);
  const showUsers = canViewUsers(role);
  const showCeo = canViewCeoDashboard(role);
  const showManager = isLineManager(role);
  const showOwner = role === 'PROJECT_OWNER';
  const showHome = showCeo ? false : showManager || investor || showOwner || rolePending;
  // Keep Projects mountable while role hydrates — href:null blanks /projects on web.
  const showProjects = showCeo || showManager || showOwner || rolePending;
  const pendingCount = useStatsStore((s) => s.stats.pendingApprovals);
  const tabBarVisible = useUiStore((s) => s.tabBarVisible);
  const router = useRouter();
  const signOut = useSignOut();
  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDesktop = useIsDesktop();

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const doExpire = useCallback(async () => {
    clearCountdown();
    setWarnOpen(false);
    try {
      await signOut.mutateAsync();
    } catch {
      /* no-op */
    }
    router.replace('/sign-in?expired=1' as never);
  }, [router, signOut, clearCountdown]);

  const { reset: resetIdle } = useIdleTimeout({
    enabled: !!role,
    warnAfterMs: 14 * 60 * 1000,
    expireAfterWarnMs: 60 * 1000,
    onWarn: () => {
      clearCountdown();
      setSecondsLeft(60);
      setWarnOpen(true);
      let remaining = 60;
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) clearCountdown();
      }, 1000);
    },
    onExpire: doExpire,
  });

  useEffect(() => () => clearCountdown(), [clearCountdown]);

  const onStay = useCallback(() => {
    clearCountdown();
    setWarnOpen(false);
    setSecondsLeft(60);
    resetIdle();
  }, [clearCountdown, resetIdle]);

  return (
    <View style={styles.shell}>
      <DesktopLeftRail pendingApprovals={pendingCount} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.muted,
          headerShown: false,
          // Keep inactive tab scenes out of the paint tree on web (see enableScreens).
          detachInactiveScreens: true,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            // Hide the bottom nav on desktop — the left rail owns navigation there.
            display: isDesktop || !tabBarVisible ? 'none' : 'flex',
          },
          // Opaque fill so a missed detach never bleeds the previous tab through.
          sceneStyle: {
            backgroundColor: palette.background,
            ...(isDesktop ? { paddingLeft: RAIL_WIDTH } : null),
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            href: showCeo ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="home"
          options={{
            title: showOwner ? 'Dashboard' : 'Home',
            href: showHome ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: 'Projects',
            href: showProjects ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="approvals"
          options={{
            title: 'Approvals',
            href: showCeo ? undefined : null,
            tabBarBadge: showCeo && pendingCount > 0 ? pendingCount : undefined,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="checkmark-circle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            href: showManager || showCeo ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="checkbox-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="portfolio"
          options={{
            title: 'Portfolio',
            href: investor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pie-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            href: investor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            href: showManager || investor || showOwner || showCeo ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            href: investor || showManager || showCeo || showOwner ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="notifications-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="invitations"
          options={{
            title: 'Invitations',
            href: null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="mail-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="statements"
          options={{
            title: 'Statements',
            href: investor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="earnings"
          options={{
            title: 'Earnings',
            href: showManager || showOwner ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cash-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: 'Users',
            href: showUsers ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      <SessionExpiredModal
        open={warnOpen}
        secondsLeft={secondsLeft}
        onStay={onStay}
        onSignOut={doExpire}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
});
