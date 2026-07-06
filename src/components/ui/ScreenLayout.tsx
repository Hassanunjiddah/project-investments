import { SafeAreaView, StyleSheet, useColorScheme } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';

type Props = {
  children: ReactNode;
};

export function ScreenLayout({ children }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: palette.background, padding: 10 }]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
