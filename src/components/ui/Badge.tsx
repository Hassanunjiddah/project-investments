import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'accent';

type Props = {
  label: string;
  variant?: BadgeVariant;
};

export function Badge({ label, variant = 'default' }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  const variantColors = {
    default: { bg: palette.primaryLight, text: palette.primary },
    success: { bg: '#E8F8F0', text: palette.success },
    warning: { bg: '#FEF5E7', text: palette.warning },
    error: { bg: palette.errorLight, text: palette.error },
    accent: { bg: palette.accentLight, text: palette.accent },
  }[variant];

  return (
    <View style={[styles.badge, { backgroundColor: variantColors.bg }]}>
      <Text style={[styles.text, { color: variantColors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
