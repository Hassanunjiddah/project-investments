import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { ProjectProgressCard } from '@/src/components/ceo/ProjectProgressCard';
import { Button } from '@/src/components/ui/Button';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useMockUserId } from '@/src/hooks/useMockUserId';
import { useAuthStore } from '@/src/store/useAuthStore';
import { canCreateProject } from '@/src/helpers/guards';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { useEffect } from 'react';

export default function MockProjectsListScreen() {
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const role = useAuthStore((s) => s.role);
  const { showTabBar } = useUiStore();
  const userId = useMockUserId();
  const version = useMockDataStore((s) => s.version);
  const getAllProjects = useMockDataStore((s) => s.getAllProjects);
  const getManagerProjects = useMockDataStore((s) => s.getManagerProjects);

  void version;

  const projects = role === 'LINE_MANAGER' ? getManagerProjects(userId) : getAllProjects();

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
