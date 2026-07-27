import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { Card } from '@/src/components/ui/Card';
import { formatNaira } from '@/src/utils/currency';

type Props = {
  /** Distribution notice ref (e.g. "PRSM-ALPHA-NOT007"). Rendered in mono. */
  reference: string;
  /** Project display name (e.g. "Prism Alpha Fund"). */
  projectName: string;
  /** Payment amount in minor units (kobo). */
  amountMinor: number;
  /** ISO date string of the notice. */
  postedAt: string;
  /** Optional period label (e.g. "Q2 2026"). */
  period?: string;
  /** Called when the user taps the card. */
  onPress?: () => void;
  /** Called when the user taps the download-PDF affordance. */
  onDownload?: () => void;
  /** Whether the PDF has been downloaded already this session. */
  downloaded?: boolean;
  testID?: string;
};

/**
 * DistributionNoticeCard — the primary tile on the investor Statements
 * screen. Left-aligned mono ref code, big serif amount, meta row (period
 * + date), and a small PDF download affordance.
 *
 * Layered depth: sits on `surface`, with a subtle left-edge accent bar
 * in navy to reinforce the "official document" feel.
 */
export function DistributionNoticeCard({
  reference,
  projectName,
  amountMinor,
  postedAt,
  period,
  onPress,
  onDownload,
  downloaded,
  testID,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  const dateLabel = new Date(postedAt).toLocaleDateString('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card
      interactive={!!onPress}
      onPress={onPress}
      testID={testID}
      style={styles.card}
    >
      {/* Left accent bar — a signature of "official notice" cards */}
      <View style={[styles.accentBar, { backgroundColor: palette.primary }]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.reference, { color: palette.textSecondary }]}>
            {reference}
          </Text>
          {period ? (
            <View style={[styles.periodChip, { borderColor: palette.brand[100], backgroundColor: palette.brand[50] }]}>
              <Text style={[styles.periodText, { color: palette.brand[700] }]}>{period}</Text>
            </View>
          ) : null}
        </View>

        <Text
          style={[styles.projectName, { color: palette.text }]}
          numberOfLines={1}
        >
          {projectName}
        </Text>

        <View style={styles.amountRow}>
          <Text style={[styles.amount, tabularNums, { color: palette.text }]}>
            {formatNaira(amountMinor)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.metaCol}>
            <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>
              Posted
            </Text>
            <Text style={[styles.metaValue, { color: palette.text }]}>
              {dateLabel}
            </Text>
          </View>

          {onDownload ? (
            <Pressable
              onPress={onDownload}
              accessibilityRole="button"
              accessibilityLabel={`Download PDF for ${reference}`}
              testID={testID ? `${testID}-download` : undefined}
              style={({ pressed, hovered }) => [
                styles.downloadBtn,
                {
                  borderColor: palette.brand[100],
                  backgroundColor: hovered ? palette.brand[50] : palette.surface,
                },
                pressed ? { transform: [{ scale: 0.98 }] } : null,
              ]}
            >
              <Feather
                name={downloaded ? 'check' : 'download'}
                size={14}
                color={palette.brand[700]}
              />
              <Text style={[styles.downloadText, { color: palette.brand[700] }]}>
                {downloaded ? 'Saved' : 'PDF'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 0,
    overflow: 'hidden',
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reference: {
    fontFamily: typography.families.mono,
    fontSize: typography.sizes.xs,
    letterSpacing: 0.4,
    fontWeight: typography.weights.medium,
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  periodText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.3,
  },
  projectName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    letterSpacing: -0.2,
  },
  amountRow: {
    marginTop: 2,
  },
  amount: {
    fontFamily: typography.families.display,
    fontSize: 28,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  bottomRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  metaCol: {
    gap: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 32,
  },
  downloadText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.2,
  },
});
