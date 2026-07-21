import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

type Size = 'sm' | 'md';

type Props = {
  size?: Size;
  /**
   * When true (default), the toggle floats absolutely inside its parent. Use
   * false to render inline (e.g. inside a settings row).
   */
  floating?: boolean;
};

/**
 * Sun/moon icon button that flips useUiStore.theme between light and dark.
 * On web the choice is persisted to localStorage so it survives reloads.
 */
export function ThemeToggle({ size = 'md', floating = false }: Props) {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const palette = colors[theme];

  const dimension = size === 'sm' ? 32 : 40;
  const iconSize = size === 'sm' ? 16 : 20;
  const isDark = theme === 'dark';

  const button = (
    <Pressable
      onPress={toggleTheme}
      testID="theme-toggle-btn"
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={({ pressed }) => [
        styles.button,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: palette.surface,
          borderColor: palette.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Feather
        name={isDark ? 'sun' : 'moon'}
        size={iconSize}
        color={palette.text}
      />
    </Pressable>
  );

  if (!floating) return button;

  return <View style={styles.floating}>{button}</View>;
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  floating: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    zIndex: 20,
  },
});
