import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { ThemeToggle } from '@/src/components/ui/ThemeToggle';

type Props = {
  children: ReactNode;
  /**
   * Hide the floating theme toggle when the screen already renders one
   * inline (e.g. Profile settings row).
   */
  hideThemeToggle?: boolean;
};

export function ScreenLayout({ children, hideThemeToggle }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: top }]}>
      {!hideThemeToggle ? <ThemeToggle floating size="sm" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
});
