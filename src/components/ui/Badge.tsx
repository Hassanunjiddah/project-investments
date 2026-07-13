import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { typography } from '@/src/constants/typography';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'accent';

type Props = {
  label: string;
  variant?: BadgeVariant;
};

export function Badge({ label, variant = 'default' }: Props) {
  const scheme = useUiStore((s) => s.theme);
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
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
