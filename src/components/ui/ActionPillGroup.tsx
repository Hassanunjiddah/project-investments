import { View, Text, Pressable, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import type { ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

type FeatherIcon = ComponentProps<typeof Feather>['name'];

export type ActionPill = {
  key: string;
  label: string;
  icon: FeatherIcon;
  /** The primary/raised action (drawn slightly larger and with brand fill). */
  primary?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
  /** Small dot overlay on the tile, e.g. a "live" or "new" indicator.
   *  When `pulse: true` on web, adds a gentle CSS animation. */
  dot?: { color: string; pulse?: boolean };
};

type Props = {
  actions: ActionPill[];
  /** Alignment. Defaults to 'space-between' for 3–4 actions. */
  distribution?: 'space-between' | 'center' | 'flex-start';
  style?: StyleProp<ViewStyle>;
};

/**
 * ActionPillGroup — a row of circular icon buttons with labels underneath
 * (the Cash-App / Robinhood "Buy · Sell · Deposit · Withdraw" pattern).
 *
 * One action can be marked `primary` — it renders slightly bigger and in
 * the brand navy, drawing the eye. Others use a soft-lavender tile.
 * All hitboxes are ≥ 56×56 to keep touch generous.
 */
export function ActionPillGroup({
  actions,
  distribution = 'space-between',
  style,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View
      style={[
        styles.row,
        { justifyContent: distribution as ViewStyle['justifyContent'] },
        style,
      ]}
    >
      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          disabled={action.disabled}
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: action.disabled }}
          style={({ pressed, hovered }) => [
            styles.actionCell,
            pressed && !action.disabled ? { transform: [{ scale: 0.96 }] } : null,
            hovered && !action.disabled ? { transform: [{ translateY: -2 }] } : null,
          ]}
        >
          <View
            style={[
              styles.tile,
              action.primary ? styles.tilePrimary : null,
              {
                backgroundColor: action.primary
                  ? palette.primary
                  : palette.brand[50],
                borderColor: action.primary
                  ? palette.primary
                  : palette.brand[100],
                opacity: action.disabled ? 0.5 : 1,
              },
            ]}
          >
            <Feather
              name={action.icon}
              size={action.primary ? 22 : 20}
              color={action.primary ? '#FFFFFF' : palette.brand[700]}
            />
            {action.dot ? (
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: action.dot.color,
                    borderColor: palette.surface,
                  },
                  Platform.OS === 'web' && action.dot.pulse
                    ? ({ animationName: 'pill-live-pulse', animationDuration: '1600ms', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' } as any)
                    : null,
                ]}
              />
            ) : null}
          </View>
          <Text
            style={[
              styles.label,
              {
                color: action.disabled ? palette.muted : palette.text,
                fontWeight: action.primary ? '700' : '600',
              },
            ]}
            numberOfLines={1}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionCell: {
    alignItems: 'center',
    gap: 6,
    // @ts-expect-error web-only
    transitionProperty: 'transform',
    transitionDuration: '160ms',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tilePrimary: {
    // Larger touch target + subtle shadow to give it lift
    width: 62,
    height: 62,
    shadowColor: '#064F92',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statusDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 2,
  },
  label: {
    fontSize: typography.sizes.xs,
    letterSpacing: 0.1,
  },
});
