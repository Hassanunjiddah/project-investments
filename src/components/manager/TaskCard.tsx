import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { ManagerTask, TaskKind } from '@/src/types/task.types';
import { pressedCardStyle } from '@/src/constants/layout';

type Props = {
  task: ManagerTask;
  onPress?: () => void;
};

const TASK_ICONS: Record<TaskKind, keyof typeof Ionicons.glyphMap> = {
  payment: 'card-outline',
  upload: 'cloud-upload-outline',
  approval: 'checkmark-circle-outline',
  message: 'chatbubble-outline',
  update: 'time-outline',
};

export function TaskCard({ task, onPress }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const icon = TASK_ICONS[task.kind ?? 'update'];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
        pressed && pressedCardStyle,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconTile, { backgroundColor: palette.primaryLight }]}>
        <Ionicons name={icon} size={16} color={palette.primary} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.text }]}>{task.title}</Text>
        {task.subtext ? (
          <Text style={[styles.sub, { color: palette.textSecondary }]}>{task.subtext}</Text>
        ) : null}
        {task.action ? (
          <Text style={[styles.action, { color: palette.primary }]}>{task.action}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  iconTile: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  sub: { fontSize: typography.sizes.xs, marginTop: 2 },
  action: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 2 },
});
