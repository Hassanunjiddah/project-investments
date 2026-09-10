import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import type { PendingAction } from '@/src/types/pendingAction.types';
import { pressedCardStyle } from '@/src/constants/layout';

type Props = {
  action: PendingAction;
  onPress?: () => void;
};

const ICON_MAP: Record<PendingAction['type'], keyof typeof Ionicons.glyphMap> = {
  payment: 'card-outline',
  upload_proof: 'cloud-upload-outline',
  awaiting_confirm: 'time-outline',
  review: 'document-text-outline',
  message: 'chatbubble-outline',
};

export function PendingActionCard({ action, onPress }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
        pressed && pressedCardStyle,
      ]}
      onPress={onPress}
    >
      <View style={[styles.icon, { backgroundColor: palette.primaryLight }]}>
        <Ionicons name={ICON_MAP[action.type]} size={16} color={palette.primary} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>
          {action.title}
        </Text>
      </View>
      <View style={[styles.timeChip, { backgroundColor: '#FEF5E7' }]}>
        <Text style={[styles.time, { color: palette.warning }]}>{action.timeRemaining}</Text>
      </View>
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
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
  timeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  time: { fontSize: 10, fontWeight: typography.weights.semibold },
});
