import { View, Text, StyleSheet } from 'react-native';
import { typography } from '@/src/constants/typography';
import { formatNaira } from '@/src/utils/currency';

type Palette = { text: string; textSecondary: string };

type Props = {
  palette: Palette;
  label: string;
  value: number;
  strong?: boolean;
  highlight?: string;
};

export function WaterfallRow({ palette, label, value, strong, highlight }: Props) {
  const isNeg = value < 0;
  return (
    <View style={styles.wfRow}>
      <Text
        style={{
          color: highlight ?? palette.textSecondary,
          fontWeight: strong ? '700' : '500',
          fontSize: typography.sizes.sm,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: highlight ?? palette.text,
          fontWeight: strong ? '700' : '600',
          fontFamily: 'monospace',
          fontSize: typography.sizes.sm,
        }}
      >
        {isNeg ? '-' : ''}
        {formatNaira(Math.abs(value))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wfRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
