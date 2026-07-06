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
  children: ReactNode;
};

export function KeyboardAvoidingScreen({ children, contentContainerStyle, ...props }: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
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
