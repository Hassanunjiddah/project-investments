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

export function KeyboardAvoidingScreen({
  children,
  contentContainerStyle,
  scrollViewRef,
  ...props
}: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
