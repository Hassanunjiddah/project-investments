import { View, Text, Pressable, StyleSheet, ScrollView, Platform } from 'react-native';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';

type Chip = {
  key: string;
  label: string;
  /** Optional trailing count badge (e.g. "3"). */
  count?: number;
};

type Props = {
  chips: Chip[];
  activeKey: string;
  onChange: (key: string) => void;
  /** Fill available width and space chips evenly. Defaults to false (scroll). */
  stretch?: boolean;
  ariaLabel?: string;
};

/**
 * ChipRow — segmented filter pills à la the Dribbble references
 * (Trending / Cryptos / Stocks / Mutual). Scrolls horizontally on
 * overflow, or spreads evenly when `stretch`. Active chip uses solid
 * navy fill; idle chips use a light-lavender surface. All chips are
 * ≥ 44px tall for accessibility.
 */
export function ChipRow({ chips, activeKey, onChange, stretch, ariaLabel }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  // On web we render as a semantic radiogroup so keyboard nav works.
  if (Platform.OS === 'web' && !stretch) {
    return (
      <div
        role="radiogroup"
        aria-label={ariaLabel ?? 'Filter'}
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: spacing.sm,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          padding: '4px 0',
        }}
      >
        {chips.map((chip) => renderChip(chip, chip.key === activeKey, palette, onChange, true))}
      </div>
    );
  }

  const content = (
    <View style={[styles.row, stretch && styles.rowStretch]}>
      {chips.map((chip) =>
        renderChip(chip, chip.key === activeKey, palette, onChange, false, stretch),
      )}
    </View>
  );

  if (stretch) return content;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => renderChip(chip, chip.key === activeKey, palette, onChange, false))}
    </ScrollView>
  );
}

function renderChip(
  chip: Chip,
  active: boolean,
  palette: ReturnType<typeof getPalette>,
  onChange: (key: string) => void,
  web: boolean,
  stretch?: boolean,
) {
  const bg = active ? palette.primary : palette.brand[50];
  const fg = active ? '#FFFFFF' : palette.brand[700];
  const border = active ? palette.primary : palette.brand[100];

  const style: any = {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: bg,
    borderColor: border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: stretch ? 1 : undefined,
    justifyContent: 'center',
  };

  if (web) {
    return (
      <button
        key={chip.key}
        role="radio"
        aria-checked={active}
        onClick={() => onChange(chip.key)}
        style={{
          ...style,
          border: `1px solid ${border}`,
          background: bg,
          color: fg,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          transition: 'background 160ms ease, border-color 160ms ease, transform 100ms ease',
        }}
      >
        <span>{chip.label}</span>
        {chip.count !== undefined ? (
          <span
            style={{
              background: active ? 'rgba(255,255,255,0.22)' : palette.brand[100],
              color: active ? '#FFFFFF' : palette.brand[700],
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {chip.count}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <Pressable
      key={chip.key}
      onPress={() => onChange(chip.key)}
      style={style}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={{ color: fg, fontSize: typography.sizes.sm, fontWeight: '600' }}>
        {chip.label}
      </Text>
      {chip.count !== undefined ? (
        <View
          style={{
            backgroundColor: active ? 'rgba(255,255,255,0.22)' : palette.brand[100],
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
          }}
        >
          <Text
            style={{
              color: active ? '#FFFFFF' : palette.brand[700],
              fontSize: typography.sizes.xs,
              fontWeight: '700',
            }}
          >
            {chip.count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Helper to keep types happy in renderChip signature.
function getPalette() {
  return colors.light;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  rowStretch: {
    flexGrow: 1,
  },
});
