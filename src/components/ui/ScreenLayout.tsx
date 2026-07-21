import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

type Props = {
  children: ReactNode;
  /**
   * Kept for backwards compatibility with screens that pass this prop; no-op
   * now that the floating theme toggle is gone. Users toggle theme from
   * Profile → Appearance.
   */
  hideThemeToggle?: boolean;
};

export function ScreenLayout({ children }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background, paddingTop: top },
      ]}
    >
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
