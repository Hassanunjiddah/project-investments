import { useEffect, useState, forwardRef } from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  Pressable,
  StyleSheet,
  type TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, motion } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { focusRingStyle } from '@/src/theme/focusRing';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  /** Show caps-lock warning when web keyboard has caps engaged (web only). */
  detectCapsLock?: boolean;
  'data-testid'?: string;
};

/**
 * Password field with visibility toggle, caps-lock detection, focus ring,
 * and error/hint slots. Uses `secureTextEntry` correctly — we swap it on
 * eye-toggle without unmounting the input, so autofill continues to work.
 */
export const PasswordField = forwardRef<RNTextInput, Props>(function PasswordField(
  { label, error, hint, detectCapsLock = true, style, onFocus, onBlur, ...props },
  ref,
) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const testId = (props as Record<string, unknown>)['data-testid'] as string | undefined;

  useEffect(() => {
    if (!detectCapsLock || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === 'function') {
        setCapsOn(e.getModifierState('CapsLock'));
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [detectCapsLock]);

  const borderColor = error ? palette.error : focused ? palette.primary : palette.border;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.ring,
          focused && !error ? focusRingStyle(scheme) : null,
        ]}
      >
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: palette.surface,
              borderColor,
            },
          ]}
        >
          <RNTextInput
            ref={ref}
            style={[
              styles.input,
              { color: palette.text, fontFamily: typography.families.ui },
              // @ts-expect-error web-only
              { outlineStyle: 'none' },
              style,
            ]}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
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
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.eyeBtn}
            testID={testId ? `${testId}-toggle` : undefined}
          >
            <Feather
              name={visible ? 'eye-off' : 'eye'}
              size={18}
              color={palette.muted}
            />
          </Pressable>
        </View>
      </View>

      {capsOn ? (
        <View style={styles.capsRow}>
          <Feather name="alert-triangle" size={12} color={palette.warning} />
          <Text style={[styles.hint, { color: palette.warning }]}>
            Caps Lock is on
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: palette.error }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: palette.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  ring: {
    borderRadius: radii.input + 2,
    // @ts-expect-error web-only
    transitionProperty: 'box-shadow, outline',
    // @ts-expect-error
    transitionDuration: `${motion.duration.std}ms`,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.input,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    minHeight: 48,
    // @ts-expect-error web-only
    transitionProperty: 'border-color',
    // @ts-expect-error
    transitionDuration: `${motion.duration.std}ms`,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.md,
    paddingVertical: 12,
  },
  eyeBtn: {
    padding: 8,
  },
  capsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hint: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
  },
  error: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
});
