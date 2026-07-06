import { useState } from 'react';
import {
  FlatList,
  Text,
  View,
  RefreshControl,
  StyleSheet,
  useColorScheme,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { useFetchPendingProjects } from '@/src/hooks/projects/useFetchPendingProjects';
import { useAuthStore } from '@/src/store/useAuthStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { formatNaira } from '@/src/utils/currency';
import { PROJECT_STAGE_LABELS, APPROVAL_STATUS_LABELS } from '@/src/types/project.types';
import { canApproveProjects, canCreateProject } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

export default function ProjectsListScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const allQuery = useFetchProjects();
  const pendingQuery = useFetchPendingProjects(showPendingOnly && canApproveProjects(role));

  const activeQuery = showPendingOnly ? pendingQuery : allQuery;
  const { data, isLoading, isError, error, refetch, isRefetching } = activeQuery;

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <EmptyState
        title="Could not load projects"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  const projects = data ?? [];

  return (
    <ScreenLayout>
      <View style={{ padding: 10, flex: 1 }}>
        <View style={styles.header}>
          <Text style={[styles.heading, { color: palette.text }]}>Projects</Text>
          {canCreateProject(role) ? (
            <Button
              title="+ New"
              onPress={() => router.push('/(tabs)/projects/create')}
              style={styles.newButton}
            />
          ) : null}
        </View>

        {canApproveProjects(role) ? (
          <Pressable
            style={[
              styles.filterChip,
              {
                backgroundColor: showPendingOnly ? palette.primaryLight : palette.surface,
                borderColor: showPendingOnly ? palette.primary : palette.border,
              },
            ]}
            onPress={() => setShowPendingOnly((v) => !v)}
          >
            <Text
              style={[
                styles.filterText,
                { color: showPendingOnly ? palette.primary : palette.textSecondary },
              ]}
            >
              {showPendingOnly ? 'Showing pending approval' : 'Show pending only'}
            </Text>
          </Pressable>
        ) : null}

        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <EmptyState
              title={showPendingOnly ? 'No pending projects' : 'No projects yet'}
              message={
                showPendingOnly
                  ? 'All projects have been reviewed.'
                  : 'Projects will appear here once created.'
              }
            />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/(tabs)/projects/${item.id}`)}>
              <View style={styles.cardHeader}>
                <Text style={[styles.projectName, { color: palette.text }]}>{item.name}</Text>
                <Badge label={PROJECT_STAGE_LABELS[item.stage]} />
              </View>
              <Text style={[styles.sector, { color: palette.textSecondary }]}>
                {item.sector}
                {item.location ? ` · ${item.location}` : ''}
              </Text>
              <View style={styles.stats}>
                <Text style={[styles.stat, { color: palette.textSecondary }]}>
                  Target: {formatNaira(item.targetKobo)}
                </Text>
                <Text style={[styles.stat, { color: palette.textSecondary }]}>
                  Raised: {formatNaira(item.raisedKobo)}
                </Text>
              </View>
              <Badge
                label={APPROVAL_STATUS_LABELS[item.approvalStatus]}
                variant={item.approvalStatus === 'APPROVED' ? 'success' : 'warning'}
              />
            </Card>
          )}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  newButton: {
    paddingHorizontal: spacing.md,
    minHeight: 40,
    paddingVertical: spacing.sm,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
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
  },
  projectName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
    marginRight: spacing.sm,
  },
  sector: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
  },
  stats: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  stat: {
    fontSize: typography.sizes.sm,
  },
});
