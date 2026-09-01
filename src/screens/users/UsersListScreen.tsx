import { useState } from 'react';
import { FlatList, Text, View, RefreshControl, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFetchUsers } from '@/src/hooks/profile/useFetchUsers';
import { useFetchProfile } from '@/src/hooks/profile/useFetchProfile';
import { canCreateUsers, canViewUsers } from '@/src/helpers/guards';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { ROLE_LABELS } from '@/src/constants/roles';
import type { Role } from '@/src/constants/roles';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

type UserFilter = 'ALL' | 'INVESTOR' | 'LINE_MANAGER' | 'PROJECT_OWNER' | 'CEO';

const FILTERS: { key: UserFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'INVESTOR', label: 'Investors' },
  { key: 'LINE_MANAGER', label: 'Line Managers' },
  { key: 'PROJECT_OWNER', label: 'Owners' },
  { key: 'CEO', label: 'CEO' },
];

export default function UsersListScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: profile } = useFetchProfile();
  const role = profile?.role ?? null;
  const [filter, setFilter] = useState<UserFilter>('ALL');
  const { data, isLoading, isError, error, refetch, isRefetching } = useFetchUsers(
    canViewUsers(role),
  );

  if (!canViewUsers(role)) {
    return <EmptyState title="Access denied" message="You do not have permission to view users." />;
  }

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <EmptyState
        title="Could not load users"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const users = (data ?? []).filter((u) => filter === 'ALL' || u.role === filter);

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: palette.text }]}>Users</Text>
        {canCreateUsers(role) ? (
          <Button
            title="+ Create"
            onPress={() => router.push('/(tabs)/users/create')}
            style={styles.createButton}
          />
        ) : null}
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[
              styles.filterChip,
              {
                backgroundColor: filter === f.key ? palette.primaryLight : palette.surface,
                borderColor: filter === f.key ? palette.primary : palette.border,
              },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f.key ? palette.primary : palette.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <EmptyState title="No users found" message="Try a different filter or create a user." />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.cardHeader}>
              <Text style={[styles.name, { color: palette.text }]}>{item.fullName}</Text>
              <Badge label={ROLE_LABELS[item.role as Role]} variant="accent" />
            </View>
            <Text style={[styles.email, { color: palette.textSecondary }]}>{item.email}</Text>
          </Card>
        )}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  createButton: {
    paddingHorizontal: spacing.md,
    minHeight: 40,
    paddingVertical: spacing.sm,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  email: {
    fontSize: typography.sizes.sm,
  },
});
