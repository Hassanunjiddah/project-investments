import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { Card } from '@/src/components/ui/Card';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { formatNaira } from '@/src/utils/currency';
import { DESKTOP_BREAKPOINT } from '@/src/components/nav/DesktopLeftRail';

/**
 * Right-side "at a glance" context panel for the Project Detail screen.
 *
 * Renders only on ≥ 960px desktop viewports. Mobile view is untouched —
 * everything the panel shows is already accessible from the tabs on
 * smaller screens.
 *
 * The panel is designed to sit alongside the main content column at a
 * fixed 320px width, giving the operator instant visibility into raised
 * progress, unit register health, and current stage without scrolling.
 */

type Props = {
  raisedMinor: number;
  targetMinor: number;
  totalUnits: number;
  unitsCommitted: number;
  unitsAvailable: number;
  investorCount: number;
  stage: string;
  approvalStatus: string;
  managerName?: string | null;
  createdAt?: string | null;
  /** Cumulative net (investor pool) realised profit for this project, in kobo. */
  investorRealisedMinor?: number;
};

export function ProjectContextPanel({
  raisedMinor,
  targetMinor,
  totalUnits,
  unitsCommitted,
  unitsAvailable,
  investorCount,
  stage,
  approvalStatus,
  managerName,
  createdAt,
  investorRealisedMinor = 0,
}: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  if (!isDesktop) return null;

  const raisedPct = targetMinor > 0 ? Math.min(100, Math.round((raisedMinor / targetMinor) * 100)) : 0;
  const committedPct = totalUnits > 0 ? Math.round((unitsCommitted / totalUnits) * 100) : 0;

  // Entry price + accumulated investor pool per unit = current net NAV
  const unitPriceMinor = totalUnits > 0 ? Math.round(targetMinor / totalUnits) : 0;
  const perUnitProfit = totalUnits > 0 ? Math.round(investorRealisedMinor / totalUnits) : 0;
  const navPerUnitMinor = unitPriceMinor + perUnitProfit;
  const navUpliftBps = unitPriceMinor > 0 ? Math.round((perUnitProfit / unitPriceMinor) * 10000) : 0;

  return (
    <View
      style={styles.panel}
      testID="project-context-panel"
      {...(Platform.OS === 'web' ? ({ 'aria-label': 'Project context panel' } as Record<string, unknown>) : {})}
    >
      {/* Raised progress hero */}
      <Card interactive={false} elevated="sm" style={styles.card}>
        <HeroBalance
          label="RAISED"
          valueMinor={raisedMinor}
          size="md"
          subtitle={`${raisedPct}% of ${formatNaira(targetMinor)} target`}
        />
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${raisedPct}%`,
                backgroundColor: raisedPct >= 100 ? palette.semantic.success.fg : palette.primary,
              },
            ]}
          />
        </View>
      </Card>

      {/* Unit register */}
      <Card interactive={false} elevated="sm" style={styles.card}>
        <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Unit Register</Text>
        <View style={styles.unitRow}>
          <View style={styles.unitCell}>
            <Text style={[styles.unitValue, tabularNums, { color: palette.text }]}>{unitsCommitted}</Text>
            <Text style={[styles.unitLabel, { color: palette.textSecondary }]}>Taken</Text>
          </View>
          <View style={[styles.unitDivider, { backgroundColor: palette.border }]} />
          <View style={styles.unitCell}>
            <Text style={[styles.unitValue, tabularNums, { color: palette.text }]}>{unitsAvailable}</Text>
            <Text style={[styles.unitLabel, { color: palette.textSecondary }]}>Available</Text>
          </View>
          <View style={[styles.unitDivider, { backgroundColor: palette.border }]} />
          <View style={styles.unitCell}>
            <Text style={[styles.unitValue, tabularNums, { color: palette.text }]}>{totalUnits}</Text>
            <Text style={[styles.unitLabel, { color: palette.textSecondary }]}>Total</Text>
          </View>
        </View>
        <Text style={[styles.unitMeta, { color: palette.textSecondary }]}>
          {committedPct}% of book placed
        </Text>
      </Card>

      {/* NAV / UNIT — visible on any project that has a unit register */}
      {totalUnits > 0 ? (
        <Card interactive={false} elevated="sm" style={styles.card}>
          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>NAV / Unit</Text>
          <View style={styles.navRow}>
            <Text style={[styles.currencyMark, { color: palette.textSecondary }]}>₦</Text>
            <Text style={[styles.navValue, tabularNums, { color: palette.text }]}>
              {(navPerUnitMinor / 100).toLocaleString('en-NG', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
            {navUpliftBps > 0 ? (
              <View
                style={[
                  styles.upliftPill,
                  { backgroundColor: palette.semantic.success.bg },
                ]}
              >
                <Feather name="trending-up" size={11} color={palette.semantic.success.fg} />
                <Text
                  style={[styles.upliftText, { color: palette.semantic.success.fg }]}
                >
                  +{(navUpliftBps / 100).toFixed(2)}%
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.unitMeta, { color: palette.textSecondary }]}>
            Entry {formatNaira(unitPriceMinor)}
            {perUnitProfit > 0 ? ` · realised +${formatNaira(perUnitProfit)} / unit` : ''}
          </Text>
        </Card>
      ) : null}

      {/* Meta */}
      <Card interactive={false} elevated="sm" style={styles.card}>
        <MetaRow
          palette={palette}
          icon="activity"
          label="Stage"
          value={humanStage(stage)}
        />
        <MetaRow
          palette={palette}
          icon="check-circle"
          label="Approval"
          value={humanApproval(approvalStatus)}
        />
        <MetaRow
          palette={palette}
          icon="users"
          label="Investors"
          value={String(investorCount)}
        />
        {managerName ? (
          <MetaRow palette={palette} icon="user" label="Line Manager" value={managerName} />
        ) : null}
        {createdAt ? (
          <MetaRow
            palette={palette}
            icon="calendar"
            label="Created"
            value={new Date(createdAt).toLocaleDateString('en-NG', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          />
        ) : null}
      </Card>
    </View>
  );
}

function MetaRow({
  palette,
  icon,
  label,
  value,
}: {
  palette: any;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <View style={[styles.metaIcon, { backgroundColor: palette.brand[50] }]}>
        <Feather name={icon} size={14} color={palette.brand[700]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>{label}</Text>
        <Text style={[styles.metaValue, { color: palette.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function humanStage(s: string): string {
  return (s || 'INITIATION').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanApproval(s: string): string {
  if (s === 'PENDING') return 'Awaiting CEO';
  if (s === 'APPROVED') return 'Approved';
  if (s === 'REJECTED') return 'Rejected';
  return s;
}

/** Hook: is the desktop split-layout available at the current viewport? */
export function useProjectSplitLayout() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}

const styles = StyleSheet.create({
  panel: {
    width: 320,
    gap: spacing.md,
    paddingLeft: spacing.md,
  },
  card: {
    marginBottom: 0,
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm + 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: spacing.xs,
  },
  currencyMark: {
    fontFamily: typography.families.display,
    fontSize: 18,
    fontWeight: typography.weights.medium,
    lineHeight: 32,
  },
  navValue: {
    fontFamily: typography.families.display,
    fontSize: 28,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  upliftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: spacing.xs,
    alignSelf: 'center',
  },
  upliftText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.2,
  },
  progressTrack: {
    marginTop: spacing.sm + 2,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 79, 146, 0.10)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unitCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  unitDivider: {
    width: 1,
    height: 32,
  },
  unitValue: {
    fontFamily: typography.families.display,
    fontSize: 26,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  unitLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  unitMeta: {
    fontSize: typography.sizes.xs,
    marginTop: spacing.sm,
    fontWeight: typography.weights.medium,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: 6,
  },
  metaIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginTop: 1,
  },
});
