import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
} from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'outlineDanger';
type ButtonSize = 'md' | 'sm';

type Props = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  style,
  ...props
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  const variantStyles = {
    primary: { bg: palette.primary, text: '#FFFFFF', border: 'transparent' },
    secondary: { bg: palette.primaryLight, text: palette.primary, border: 'transparent' },
    danger: { bg: palette.errorLight, text: palette.error, border: 'transparent' },
    outline: { bg: 'transparent', text: palette.primary, border: palette.primary },
    outlineDanger: { bg: 'transparent', text: palette.error, border: palette.error },
  }[variant];

  const isOutline = variant === 'outline' || variant === 'outlineDanger';
  const sizeStyles = size === 'sm' ? styles.sm : styles.md;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        sizeStyles,
        {
          backgroundColor: variantStyles.bg,
          borderColor: variantStyles.border,
          borderWidth: isOutline ? 1 : 0,
          opacity: pressed || disabled || loading ? 0.7 : 1,
        },
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.text} />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'sm' ? styles.textSm : styles.textMd,
            { color: variantStyles.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  md: {
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sm: {
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  text: {
    fontWeight: typography.weights.semibold,
  },
  textMd: {
    fontSize: typography.sizes.sm,
  },
  textSm: {
    fontSize: typography.sizes.xs,
  },
});
