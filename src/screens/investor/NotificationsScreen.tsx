import { Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { typography } from '@/src/constants/typography';
import { spacing } from '@/src/constants/spacing';

export default function NotificationsScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Notifications</Text>
      <EmptyState
        title="All caught up"
        message="Invitations, payment confirmations, and project updates will appear here."
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
  },
});
