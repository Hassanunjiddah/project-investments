import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

export type PasswordCheck = {
  key: string;
  label: string;
  met: boolean;
};

const RULES = [
  { key: 'len', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'letter', label: 'Contains a letter', test: (p: string) => /[A-Za-z]/.test(p) },
  { key: 'number', label: 'Contains a number', test: (p: string) => /\d/.test(p) },
] as const;

export function evaluatePassword(password: string): PasswordCheck[] {
  return RULES.map(({ key, label, test }) => ({ key, label, met: test(password) }));
}

/** All 3 rules must be met. */
export function isPasswordStrong(password: string): boolean {
  return evaluatePassword(password).every((r) => r.met);
}

type Props = {
  password: string;
  'data-testid'?: string;
};

export function PasswordStrength({ password, ...props }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const checks = evaluatePassword(password);
  const met = checks.filter((c) => c.met).length;
  const total = checks.length;
  const pct = (met / total) * 100;
  const testId = props['data-testid'];

  const barColor =
    met === 0 ? palette.border : met < total ? palette.warning : palette.semantic.success.fg;

  return (
    <View style={styles.wrap} testID={testId}>
      <View style={[styles.track, { backgroundColor: palette.border }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      <View style={styles.list}>
        {checks.map((c) => (
          <View key={c.key} style={styles.item}>
            <Feather
              name={c.met ? 'check-circle' : 'circle'}
              size={14}
              color={c.met ? palette.semantic.success.fg : palette.muted}
            />
            <Text
              style={[
                styles.label,
                {
                  color: c.met ? palette.text : palette.textSecondary,
                  fontWeight: c.met ? '500' : '400',
                },
              ]}
            >
              {c.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  track: {
    height: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
    transitionProperty: 'width, background-color',
    transitionDuration: '180ms',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  list: {
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: typography.families.ui,
    fontSize: typography.sizes.xs,
  },
});
