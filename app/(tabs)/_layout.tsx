import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { isInvestor, canViewUsers, canViewCeoDashboard, isLineManager } from '@/src/helpers/guards';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { colors } from '@/src/constants/colors';
import { useUiStore } from '@/src/store/useUiStore';
import { useStatsStore } from '@/src/store/useStatsStore';

export default function TabLayout() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: profile } = useFetchProfile();
  const role = profile?.role ?? null;
  const investor = isInvestor(role);
  const showUsers = canViewUsers(role);
  const showCeo = canViewCeoDashboard(role);
  const showManager = isLineManager(role);
  const version = useMockDataStore((s) => s.version);
  const pendingCount = useStatsStore((s) => s.stats.pendingApprovals);
  void version;
  const tabBarVisible = useUiStore((s) => s.tabBarVisible);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.muted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
          display: tabBarVisible ? 'flex' : 'none',
        },
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
          // href: showManager ? undefined : null,
          href: null,
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
          // href: investor ? undefined : null,
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          title: 'Messages',
          // href: showManager ? undefined : null,
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications/index"
        options={{
          title: 'Notifications',
          href: investor ? undefined : null,
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
      <Tabs.Screen name="invitations/[id]" options={{ href: null }} />
      <Tabs.Screen name="projects/[id]" options={{ href: null }} />
    </Tabs>
  );
}
