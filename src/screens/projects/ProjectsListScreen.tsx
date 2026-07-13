import { FlatList, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { Button } from '@/src/components/ui/Button';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { canApproveProjects, canCreateProject } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
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
  const { showTabBar } = useUiStore();
  const version = useMockDataStore((s) => s.version);
  const [showPendingOnly, setShowPendingOnly] = useState(false);

  const allQuery = useFetchProjects();
  const pendingQuery = useFetchPendingProjects(showPendingOnly && canApproveProjects(role));

  const activeQuery = showPendingOnly ? pendingQuery : allQuery;
  const { data, isLoading, isError, error, refetch, isRefetching } = activeQuery;

  void version;

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
          <Text style={[styles.empty, { color: palette.muted }]}>No projects found</Text>
        }
      />
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
  list: { paddingBottom: spacing.xxl },
  empty: { textAlign: 'center', marginTop: spacing.xxl, fontSize: typography.sizes.sm },
});
