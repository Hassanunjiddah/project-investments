import { FlatList, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { Button } from '@/src/components/ui/Button';
import { SkeletonCard } from '@/src/components/ui/Skeleton';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useAuthStore } from '@/src/store/useAuthStore';
import { canApproveProjects, canCreateProject, isProjectOwner } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing , scrollBottomInset} from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { useEffect, useState } from 'react';
import { useFetchProjects } from '@/src/hooks/projects/useFetchProjects';
import { useFetchPendingProjects } from '@/src/hooks/projects/useFetchPendingProjects';

export default function ProjectsListScreen() {
  const router = useRouter();

  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.session?.user?.id) ?? useAuthStore((s) => s.user?.id);
  const { showTabBar } = useUiStore();
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const ownerScope = isProjectOwner(role) ? { ownerId: userId ?? '' } : undefined;
  const allQuery = useFetchProjects(ownerScope);
  const pendingQuery = useFetchPendingProjects(showPendingOnly && canApproveProjects(role));

  const activeQuery = showPendingOnly ? pendingQuery : allQuery;
  const { data, isLoading, isError, error, refetch, isRefetching } = activeQuery;

  const projects = data?.data ?? [];

  useEffect(() => {
    showTabBar();
  }, [showTabBar]);

  return (
    <ScreenLayout>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>Projects</Text>
        {canCreateProject(role) ? (
          <Button title="+ New" size="sm" onPress={() => router.push('/(tabs)/projects/create')} />
        ) : null}
      </View>
      {isLoading ? (
        <View style={{ gap: spacing.sm }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <EmptyState
          icon="alert-circle"
          title="Could not load projects"
          message={error?.message ?? 'Please try again.'}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }) => (
            <ProjectProgressCard
              project={item}
              showInvestorCount={role === 'LINE_MANAGER'}
              onPress={() => router.push(`/(tabs)/projects/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="folder-plus"
              title={
                showPendingOnly
                  ? 'No pending approvals'
                  : isProjectOwner(role)
                    ? 'No assigned projects'
                    : 'No projects yet'
              }
              message={
                showPendingOnly
                  ? 'When line managers submit projects for approval, they land here.'
                  : isProjectOwner(role)
                    ? 'Only projects a Prism Line Manager assigns you to own will show here.'
                    : canApproveProjects(role)
                      ? 'Approved and in-flight projects across Prism appear here.'
                    : canCreateProject(role)
                      ? 'Kick off your first project — the wizard walks you through units, target, and required documents.'
                      : 'Projects you manage will appear here.'
              }
              actionLabel={canCreateProject(role) && !showPendingOnly ? 'Create your first project' : undefined}
              onAction={
                canCreateProject(role) && !showPendingOnly
                  ? () => router.push('/(tabs)/projects/create')
                  : undefined
              }
            />
          }
        />
      )}
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
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  list: { paddingBottom: scrollBottomInset },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sizes.sm },
});
