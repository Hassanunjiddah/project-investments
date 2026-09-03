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
  ...props
}: Props) {
  if (Platform.OS === 'web') {
    return (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentContainerStyle]}
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
      style={styles.flex}
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
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
});
