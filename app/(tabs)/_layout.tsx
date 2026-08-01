import { Tabs, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { isInvestor, canViewUsers, canViewCeoDashboard, isLineManager } from '@/src/helpers/guards';
import { useMockDataStore } from '@/src/store/useMockDataStore';
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
  // Prefer hydrated auth-store role so tab visibility never briefly falls
  // through to "no tabs" (or the wrong role's tabs) while profile reloads.
  const storeRole = useAuthStore((s) => s.role);
  const role = profile?.role ?? storeRole;
  const investor = isInvestor(role);
  const showUsers = canViewUsers(role);
  const showCeo = canViewCeoDashboard(role);
  const showManager = isLineManager(role);
  const version = useMockDataStore((s) => s.version);
  const pendingCount = useStatsStore((s) => s.stats.pendingApprovals);
  void version;
  const tabBarVisible = useUiStore((s) => s.tabBarVisible);
  const router = useRouter();
  const signOut = useSignOut();
  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const isDesktop = useIsDesktop();

  const doExpire = useCallback(async () => {
    setWarnOpen(false);
    try {
      await signOut.mutateAsync();
    } catch {
      /* no-op */
    }
    router.replace('/sign-in?expired=1' as never);
  }, [router, signOut]);

  useIdleTimeout({
    enabled: !!role,
    warnAfterMs: 29 * 60 * 1000,
    expireAfterWarnMs: 60 * 1000,
    onWarn: () => {
      setSecondsLeft(60);
      setWarnOpen(true);
      // Local countdown display while the outer expireTimer runs.
      let remaining = 60;
      const id = setInterval(() => {
        remaining -= 1;
        setSecondsLeft(remaining);
        if (remaining <= 0) clearInterval(id);
      }, 1000);
    },
    onExpire: doExpire,
  });

  return (
    <>
      <DesktopLeftRail pendingApprovals={pendingCount} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: palette.primary,
          tabBarInactiveTintColor: palette.muted,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: palette.surface,
            borderTopColor: palette.border,
            // Hide the bottom nav on desktop — the left rail owns navigation there.
            display: isDesktop || !tabBarVisible ? 'none' : 'flex',
          },
          sceneStyle: isDesktop ? { paddingLeft: RAIL_WIDTH } : undefined,
        }}
      >
        <Tabs.Screen
          name="dashboard/index"
          options={{
            title: 'Dashboard',
            href: showCeo ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="grid-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="home/index"
          options={{
            title: 'Home',
            href: showCeo ? null : showManager || investor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: 'Projects',
            href: showCeo || showManager ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="briefcase-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="approvals/index"
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
          name="tasks/index"
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
          name="explore/index"
          options={{
            title: 'Explore',
            href: investor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="compass-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="messages/index"
          options={{
            title: 'Messages',
            href: showManager || investor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="messages/[id]" options={{ href: null }} />
        <Tabs.Screen
          name="notifications/index"
          options={{
            title: 'Notifications',
            href: investor || showManager || showCeo ? undefined : null,
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
          name="statements/index"
          options={{
            title: 'Statements',
            href: investor ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="earnings/index"
          options={{
            title: 'Earnings',
            href: showManager ? undefined : null,
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
          name="profile/index"
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
        onStay={() => setWarnOpen(false)}
        onSignOut={doExpire}
      />
    </>
  );
}
