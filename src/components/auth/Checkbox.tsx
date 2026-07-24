import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  'data-testid'?: string;
};

/**
 * Small, keyboard-accessible checkbox styled to match the token system.
 * Uses a real Pressable so it works on native + web with focus ring.
 */
export function Checkbox({ checked, onChange, label, ...props }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const testId = props['data-testid'];
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={styles.row}
      testID={testId}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? palette.primary : palette.border,
            backgroundColor: checked ? palette.primary : palette.surface,
          },
        ]}
      >
        {checked ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
      </View>
      <Text
        style={[styles.label, { color: palette.text, fontFamily: typography.families.ui }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: radii.sm - 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.sizes.sm,
  },
});
