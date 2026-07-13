import { Controller, useFormContext } from 'react-hook-form';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { formatDate } from '@/src/utils/date';

type Props = {
  name: string;
  label?: string;
};

export function FormDatePicker({ name, label }: Props) {
  const { control } = useFormContext();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.wrapper}>
          {label ? <Text style={[styles.label, { color: palette.text }]}>{label}</Text> : null}
          <Pressable
            style={[
              styles.input,
              { backgroundColor: palette.surface, borderColor: palette.border },
            ]}
            onPress={() => onChange(new Date().toISOString())}
          >
            <Text style={{ color: palette.text }}>{value ? formatDate(value) : 'Select date'}</Text>
          </Pressable>
          {error ? (
            <Text style={[styles.error, { color: palette.error }]}>{error.message}</Text>
          ) : null}
        </View>
      )}
    />
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
  },
  error: {
    fontSize: typography.sizes.xs,
  },
});
