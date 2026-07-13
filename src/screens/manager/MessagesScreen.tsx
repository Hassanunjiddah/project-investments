import { Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { colors } from '@/src/constants/colors';
import { typography } from '@/src/constants/typography';
import { spacing } from '@/src/constants/spacing';

export default function MessagesScreen() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Messages</Text>
      <EmptyState
        title="No messages yet"
        message="Investor and CEO conversations will appear here."
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
