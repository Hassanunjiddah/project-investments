import type { ReactNode } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii, elevation } from '@/src/constants/spacing';
import { BrandCanvas } from '@/src/components/auth/BrandCanvas';
import { useIsDesktop } from '@/src/constants/layout';
import { PageScroll } from '@/src/components/ui/PageScroll';
import { WebFlexFill } from '@/src/components/nav/WebFlexFill';

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
 * Desktop (≥ shared DESKTOP_BREAKPOINT): split-screen. Left = brand canvas, right = form.
 * Mobile: brand strip on top, form beneath. Uses only local components
 * (no new libs).
 *
 * Web: never use RN ScrollView here — it can freeze the main thread and steal
 * wheel events. The form column is a real HTML overflow:auto box instead.
 */
export function AuthShell({ children, footer, testID }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { top, bottom } = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  const formCard = (
    <View
      style={[
        styles.formInner,
        isDesktop ? styles.formCard : null,
        isDesktop && scheme === 'light' ? elevation.lg : null,
        isDesktop
          ? { backgroundColor: palette.surface, borderColor: palette.border }
          : null,
      ]}
    >
      {children}
      {footer ? <View style={styles.footerBlock}>{footer}</View> : null}
    </View>
  );

  if (isDesktop) {
    const rightPad = {
      paddingTop: spacing.xl,
      paddingBottom: bottom + spacing.xl,
      paddingLeft: spacing.xl,
      paddingRight: spacing.xl,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      boxSizing: 'border-box' as const,
    };

    return (
      <View testID={testID} style={[styles.rootDesktop, { backgroundColor: palette.background }]}>
        <View style={styles.leftPanel}>
          <BrandCanvas />
        </View>
        {Platform.OS === 'web' ? (
          <WebFlexFill
            label="auth-form"
            scroll
            backgroundColor={palette.background}
            style={rightPad}
          >
            {formCard}
          </WebFlexFill>
        ) : (
          <View style={[styles.rightPanel, { backgroundColor: palette.background }]}>
            <PageScroll
              contentContainerStyle={[
                styles.rightScroll,
                { paddingTop: spacing.xl, paddingBottom: bottom + spacing.xl },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {formCard}
            </PageScroll>
          </View>
        )}
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
      {Platform.OS === 'web' ? (
        <WebFlexFill
          label="auth-form-mobile"
          scroll
          backgroundColor={palette.background}
          style={{
            marginTop: -20,
            borderTopLeftRadius: radii.sheet,
            borderTopRightRadius: radii.sheet,
            paddingLeft: spacing.lg,
            paddingRight: spacing.lg,
            paddingTop: spacing.xl,
            paddingBottom: bottom + spacing.xl,
            boxSizing: 'border-box',
          }}
        >
          {formCard}
        </WebFlexFill>
      ) : (
        <PageScroll
          style={[styles.mobileSheet, { backgroundColor: palette.background }]}
          contentContainerStyle={[styles.mobileScroll, { paddingBottom: bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {formCard}
        </PageScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootDesktop: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    minHeight: 0,
  },
  leftPanel: {
    flex: 1,
    minHeight: 0,
  },
  rightPanel: {
    flex: 1,
    minHeight: 0,
  },
  rightScroll: {
    flexGrow: 1,
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
    width: '100%',
    height: '100%',
    minHeight: 0,
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
