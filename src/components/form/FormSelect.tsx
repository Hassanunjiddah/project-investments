import { Controller, useFormContext } from 'react-hook-form';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Option = {
  label: string;
  value: string;
};

type Props = {
  name: string;
  label?: string;
  options: Option[];
};

export function FormSelect({ name, label, options }: Props) {
  const { control } = useFormContext();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <View style={styles.wrapper}>
          {label ? <Text style={[styles.label, { color: palette.text }]}>{label}</Text> : null}
          <View style={styles.options}>
            {options.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.option,
                  {
                    backgroundColor:
                      value === option.value ? palette.primaryLight : palette.surface,
                    borderColor: value === option.value ? palette.primary : palette.border,
                  },
                ]}
                onPress={() => onChange(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: value === option.value ? palette.primary : palette.text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
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
  options: {
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
  },
  optionText: {
    fontSize: typography.sizes.md,
  },
  error: {
    fontSize: typography.sizes.xs,
  },
});
