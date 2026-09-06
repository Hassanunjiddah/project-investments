import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { useIsDesktop } from '@/src/constants/layout';
import { WebFlexFill } from '@/src/components/nav/WebFlexFill';

type Props = {
  children: ReactNode;
  hideThemeToggle?: boolean;
};

export function ScreenLayout({ children }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { top } = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  if (Platform.OS === 'web') {
    return (
      <WebFlexFill
        scroll
        backgroundColor={palette.background}
        style={{
          paddingTop: Math.max(top, spacing.sm),
          paddingLeft: spacing.md,
          paddingRight: spacing.md,
          paddingBottom: isDesktop ? spacing.md : 88,
          maxWidth: isDesktop ? 1400 : undefined,
          marginLeft: isDesktop ? 'auto' : undefined,
          marginRight: isDesktop ? 'auto' : undefined,
        }}
      >
        {children}
      </WebFlexFill>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background,
          paddingTop: top,
          maxWidth: isDesktop ? 1400 : undefined,
          alignSelf: isDesktop ? 'center' : 'stretch',
          width: '100%',
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
