import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { DESKTOP_BREAKPOINT } from '@/src/components/nav/DesktopLeftRail';

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
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          paddingTop: top,
          // On desktop the fixed left rail is 240px wide — content must clear
          // it. On mobile the bottom nav is used and no inset is needed.
          paddingLeft: isDesktop ? 240 + spacing.md : spacing.md,
          // Center the content column on ultrawide screens so text never
          // stretches across a huge canvas.
          maxWidth: isDesktop ? 1400 : undefined,
          alignSelf: isDesktop ? 'flex-start' : undefined,
          width: isDesktop ? '100%' : undefined,
        },
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
