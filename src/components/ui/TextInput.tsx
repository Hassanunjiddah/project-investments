import { useState } from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

/**
 * Refined input (Feb 2026): taller 48px container with 12px radius, small
 * uppercase caption-style label above, 2px primary focus ring, distinct
 * error styling with matching helper text. Web-only CSS transitions add
 * gentle motion on focus.
 */
export function TextInput({ label, error, style, onFocus, onBlur, ...props }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [focused, setFocused] = useState(false);

  const rest = props as Record<string, unknown>;
  const testId =
    (rest['data-testid'] as string | undefined) ?? (rest.testID as string | undefined);

  const borderColor = error
    ? palette.error
    : focused
      ? palette.primary
      : palette.border;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.ring,
          {
            // 2px focus ring using an outer glow — RN doesn't support box-shadow
            // reliably, so we mimic it with a colored border wrapper on focus.
            borderColor:
              error
                ? `rgba(239, 68, 68, 0.25)`
                : focused
                  ? `rgba(${palette.primaryRgb}, 0.18)`
                  : 'transparent',
          },
        ]}
      >
        <RNTextInput
          style={[
            styles.input,
            {
              backgroundColor: palette.surface,
              borderColor,
              color: palette.text,
              // Web-only: remove default browser outline; we render our own
              // focus ring.
              outline: 'none',
            },
            props.multiline ? styles.multiline : null,
            style,
          ]}
          placeholderTextColor={palette.muted}
          testID={testId}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
      </View>
      {error ? <Text style={[styles.error, { color: palette.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  ring: {
    borderRadius: radii.md + 4,
    borderWidth: 3,
    transitionProperty: 'border-color',
    transitionDuration: '160ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    padding: 0,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    paddingVertical: 12,
    fontSize: typography.sizes.md,
    transitionProperty: 'border-color',
    transitionDuration: '160ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  error: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  multiline: {
    minHeight: 96,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
