import {
  KeyboardAvoidingView,
  ScrollView,
  View,
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
 * Scrollable form shell. On web the document is the scroller — a nested
 * RN ScrollView captures wheel events and freezes the page.
 */
export function KeyboardAvoidingScreen({
  children,
  contentContainerStyle,
  scrollViewRef,
  style,
  ...props
}: Props) {
  if (Platform.OS === 'web') {
    return <View style={[styles.webPage, style, contentContainerStyle]}>{children}</View>;
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
  webPage: {
    width: '100%',
    paddingBottom: spacing.xl,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
});
