import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'error'
  | 'accent'
  | 'info'
  | 'muted';

type Props = {
  label: string;
  variant?: BadgeVariant;
  /** Show a solid dot before the label for extra visual anchor. */
  withDot?: boolean;
};

/**
 * Soft-filled pill badge (Feb 2026). Uses tinted `xxxLight` background with
 * a fully-saturated text/dot so status is instantly readable. Includes an
 * optional 4px dot per the design blueprint for stage chips.
 */
export function Badge({ label, variant = 'default', withDot = true }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const variantColors: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
    default: { bg: palette.primaryLight, text: palette.primary, dot: palette.primary },
    success: { bg: palette.primaryLight, text: palette.success, dot: palette.success },
    warning: { bg: palette.warningLight, text: palette.warning, dot: palette.warning },
    error: { bg: palette.errorLight, text: palette.error, dot: palette.error },
    accent: { bg: palette.accentLight, text: palette.accent, dot: palette.accent },
    info: { bg: palette.infoLight, text: palette.info, dot: palette.info },
    muted: { bg: palette.surfaceMuted, text: palette.textSecondary, dot: palette.textSecondary },
  };
  const c = variantColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {withDot ? <View style={[styles.dot, { backgroundColor: c.dot }]} /> : null}
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.full,
  },
  text: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
