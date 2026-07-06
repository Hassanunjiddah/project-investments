import { FlatList, Text, StyleSheet, useColorScheme } from 'react-native';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { TaskCard } from '@/src/components/manager/TaskCard';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { useMockUserId } from '@/src/hooks/useMockUserId';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

export default function TasksScreen() {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const userId = useMockUserId();
  const version = useMockDataStore((s) => s.version);
  const getManagerTasks = useMockDataStore((s) => s.getManagerTasks);

  void version;
  const tasks = getManagerTasks(userId);

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Tasks</Text>
      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <TaskCard task={item} />}
        contentContainerStyle={styles.list}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, marginBottom: spacing.lg },
  list: { paddingBottom: spacing.xxl },
});
