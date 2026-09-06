import { useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput as RNTextInput,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, motion } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { focusRingStyle } from '@/src/theme/focusRing';

type Props = {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
};

/**
 * Segmented code input. 8 (configurable) boxes with:
 *  • auto-advance on keystroke
 *  • backspace jumps to previous box
 *  • paste anywhere pastes the whole code
 *  • normalises to A-Z0-9 uppercase
 *
 * Preserves a hidden aggregate value for form binding — pass `value` and
 * `onChange` from the parent.
 */
export function SegmentedCodeInput({
  length = 8,
  value,
  onChange,
  onComplete,
  autoFocus,
  disabled,
  ...props
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const refs = useRef<(RNTextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const testId = props['data-testid'];
  const { width } = useWindowDimensions();
  // 8 boxes at 36px + gaps overflow ~320px phones — shrink cells there.
  const compact = width < 380;

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (value.length === length && onComplete) onComplete(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const setChar = (index: number, ch: string) => {
    const normalized = ch.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!normalized) {
      // backspace on empty box: move focus left
      const chars = value.split('');
      chars[index] = '';
      onChange(chars.join('').slice(0, length));
      if (index > 0) refs.current[index - 1]?.focus();
      return;
    }
    // if the input is a paste of multiple chars, distribute across boxes
    if (normalized.length > 1) {
      const merged = (value.slice(0, index) + normalized).slice(0, length).padEnd(length, '');
      const trimmed = merged.replace(/\s+$/, '');
      onChange(trimmed);
      const nextIndex = Math.min(trimmed.length, length - 1);
      refs.current[nextIndex]?.focus();
      return;
    }
    const chars = value.padEnd(length, ' ').split('');
    chars[index] = normalized;
    const next = chars.join('').replace(/ /g, '').slice(0, length);
    onChange(next);
    if (index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKey = (index: number, key: string) => {
    if (key === 'Backspace') {
      if (!value[index] && index > 0) {
        refs.current[index - 1]?.focus();
      } else {
        const chars = value.split('');
        chars[index] = '';
        onChange(chars.join(''));
      }
    }
    if (key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
  };

  return (
    <View style={[styles.row, compact ? styles.rowCompact : null]} testID={testId}>
      {Array.from({ length }).map((_, i) => {
        const ch = value[i] ?? '';
        const isFocused = focusedIndex === i;
        return (
          <RNTextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={ch}
            onChangeText={(t) => setChar(i, t)}
            onKeyPress={(e) => handleKey(i, e.nativeEvent.key)}
            onFocus={() => setFocusedIndex(i)}
            onBlur={() => setFocusedIndex(null)}
            maxLength={1}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!disabled}
            selectTextOnFocus
            style={
              [
                styles.box,
                compact ? styles.boxCompact : null,
                {
                  backgroundColor: palette.surface,
                  borderColor: isFocused ? palette.primary : palette.border,
                  color: palette.text,
                  fontFamily: typography.families.mono,
                },
                isFocused ? focusRingStyle(scheme) : null,
                Platform.OS === 'web'
                  ? {
                      outlineStyle: 'none',
                      transitionProperty: 'border-color, box-shadow',
                      transitionDuration: `${motion.duration.std}ms`,
                    }
                  : null,
              ] as never
            }
            testID={testId ? `${testId}-${i}` : undefined}
            {...(testId ? ({ 'data-testid': `${testId}-${i}` } as Record<string, string>) : {})}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    justifyContent: 'space-between',
  },
  rowCompact: {
    gap: 4,
  },
  box: {
    flex: 1,
    minWidth: 36,
    height: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 2,
  },
  boxCompact: {
    minWidth: 28,
    height: 48,
    fontSize: 18,
    letterSpacing: 1,
  },
});
