import { Pressable, Text, StyleSheet } from 'react-native';
import type { ToastItem } from '@/src/store/useUiStore';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  toast: ToastItem;
  onDismiss: () => void;
};

const TOAST_COLORS = {
  success: { bg: '#1B6B3A', text: '#FFFFFF' },
  error: { bg: '#C0392B', text: '#FFFFFF' },
  info: { bg: '#2C3E50', text: '#FFFFFF' },
};

export function Toast({ toast, onDismiss }: Props) {
  const palette = TOAST_COLORS[toast.type];

  return (
    <Pressable style={[styles.toast, { backgroundColor: palette.bg }]} onPress={onDismiss}>
      <Text style={[styles.text, { color: palette.text }]}>{toast.message}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toast: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
});
