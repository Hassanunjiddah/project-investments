import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { Button } from '@/src/components/ui/Button';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

type Props = {
  title: string;
  message?: string;
  /** Optional Feather icon rendered in a tinted tile above the title. */
  icon?: FeatherName;
  actionLabel?: string;
  onAction?: () => void;
  'data-testid'?: string;
};

/**
 * Designed empty state: icon tile + title + optional message + optional CTA.
 * Uses the token system — semantic muted surface for the icon tile.
 */
export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const testId = props['data-testid'];

  return (
    <View style={styles.container} testID={testId}>
      {icon ? (
        <View
          style={[
            styles.iconTile,
            {
              backgroundColor: palette.brand[50],
              borderColor: palette.border,
            },
          ]}
        >
          <Feather name={icon} size={22} color={palette.primary} />
        </View>
      ) : null}
      <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: palette.textSecondary }]}>{message}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.families.display,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  message: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  button: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    maxWidth: 280,
  },
});
