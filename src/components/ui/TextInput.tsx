import {
  TextInput as RNTextInput,
  View,
  Text,
  StyleSheet,
  type TextInputProps,
  useColorScheme,
} from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function TextInput({ label, error, style, ...props }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={[styles.label, { color: palette.text }]}>{label}</Text> : null}
      <RNTextInput
        style={[
          styles.input,
          {
            backgroundColor: palette.surface,
            borderColor: error ? palette.error : palette.border,
            color: palette.text,
            outline: 'none',
          },
          style,
        ]}
        placeholderTextColor={palette.muted}
        {...props}
      />
      {error ? <Text style={[styles.error, { color: palette.error }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: typography.sizes.md,
  },
  error: {
    fontSize: typography.sizes.xs,
  },
});
