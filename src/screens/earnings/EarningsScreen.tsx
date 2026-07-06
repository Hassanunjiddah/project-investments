import { Text, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Button } from '@/src/components/ui/Button';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { routes } from '@/src/constants/routes';

export default function EarningsScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <ScreenLayout>
      <EmptyState
        title="Earnings coming soon"
        message="Mudarabah profit slips and distribution history will be available here."
      />
      <Button
        title="View Profile"
        variant="secondary"
        onPress={() => router.push(routes.PROFILE)}
        style={styles.button}
      />
      <Text style={[styles.hint, { color: palette.textSecondary }]}>
        Profit distribution is managed per project after realised profit is confirmed.
      </Text>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: spacing.md,
  },
  hint: {
    textAlign: 'center',
    marginTop: spacing.lg,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
});
