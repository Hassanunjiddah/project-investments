import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

type Props = {
  name: string;
  subtitle: string;
};

export function GreetingHeader({ name, subtitle }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.greeting, { color: palette.text }]}>
        {getGreeting()}, {name} 👋
      </Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  greeting: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
    textTransform: 'capitalize',
  },
  subtitle: { fontSize: typography.sizes.xs, lineHeight: 18 },
});
