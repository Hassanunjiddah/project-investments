import { StyleSheet, useColorScheme, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  children: ReactNode;
};

export function ScreenLayout({ children }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const { top } = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: top }]}>
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
