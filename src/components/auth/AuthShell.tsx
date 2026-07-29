import type { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, elevation } from '@/src/constants/spacing';
import { BrandCanvas } from '@/src/components/auth/BrandCanvas';

const DESKTOP_BREAKPOINT = 1024;

type Props = {
  children: ReactNode;
  /** Optional footer element (e.g. "Already have a password? Sign in"). */
  footer?: ReactNode;
  /** Optional test-id root */
  testID?: string;
};

/**
 * Cohesive auth-page shell.
 *
 * Desktop (≥1024px): split-screen. Left = brand canvas, right = form.
 * Mobile: brand strip on top, form beneath. Uses only local components
 * (no new libs).
 */
export function AuthShell({ children, footer, testID }: Props) {
  const { width } = useWindowDimensions();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { top, bottom } = useSafeAreaInsets();
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  if (isDesktop) {
    return (
      <View
        testID={testID}
        style={[styles.rootDesktop, { backgroundColor: palette.background }]}
      >
        <View style={styles.leftPanel}>
          <BrandCanvas />
        </View>
        <View style={[styles.rightPanel, { backgroundColor: palette.background }]}>
          <ScrollView
            contentContainerStyle={[
              styles.rightScroll,
              { paddingTop: spacing.xl, paddingBottom: bottom + spacing.xl },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.formInner,
                styles.formCard,
                scheme === 'light' ? elevation.lg : null,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              {children}
              {footer ? <View style={styles.footerBlock}>{footer}</View> : null}
            </View>
          </ScrollView>
        </View>
      </View>
    );
  }

  // Mobile — condensed brand banner + form
  return (
    <View
      testID={testID}
      style={[styles.rootMobile, { backgroundColor: palette.background, paddingTop: top }]}
    >
      <View style={styles.mobileBanner}>
        <BrandCanvas compact />
      </View>
      <ScrollView
        style={[styles.mobileSheet, { backgroundColor: palette.background }]}
        contentContainerStyle={[
          styles.mobileScroll,
          { paddingBottom: bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formInner}>
          {children}
          {footer ? <View style={styles.footerBlock}>{footer}</View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootDesktop: {
    flex: 1,
    flexDirection: 'row',
    minHeight: Platform.OS === 'web' ? '100vh' as unknown as number : undefined,
  },
  leftPanel: {
    flex: 1,
    minHeight: 600,
  },
  rightPanel: {
    flex: 1,
  },
  rightScroll: {
    minHeight: '100%' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  formInner: {
    width: '100%',
    maxWidth: 440,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: radii.sheet,
    padding: spacing.xl,
  },
  footerBlock: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  rootMobile: {
    flex: 1,
  },
  mobileBanner: {
    height: 112,
  },
  // Rounded sheet that overlaps the brand banner — modern bottom-sheet feel.
  mobileSheet: {
    flex: 1,
    marginTop: -20,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  mobileScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
});
