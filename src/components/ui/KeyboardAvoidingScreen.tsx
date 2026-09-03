import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StyleSheet,
  type ScrollViewProps,
} from 'react-native';
import type { ReactNode } from 'react';
import { spacing } from '@/src/constants/spacing';

type Props = ScrollViewProps & {
  scrollViewRef?: React.RefObject<ScrollView | null>;
  children: ReactNode;
};

/**
 * Scrollable form shell. On web, do NOT use KeyboardAvoidingView
 * `behavior="height"` — RN-web collapses the scene to a blank viewport.
 */
export function KeyboardAvoidingScreen({
  children,
  contentContainerStyle,
  scrollViewRef,
  style,
  ...props
}: Props) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        style={[styles.flex, styles.webFlex, style]}
        contentContainerStyle={[styles.content, styles.webContent, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        ref={scrollViewRef}
        {...props}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  webFlex: {
    // @ts-expect-error web-only CSS length — prevents 0-height blank scenes
    minHeight: '100%',
    width: '100%',
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  webContent: {
    // @ts-expect-error web-only CSS length
    minHeight: '100%',
  },
});
