import { View, Text, StyleSheet, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { Card } from '@/src/components/ui/Card';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { MiniSparkline } from '@/src/components/ui/MiniSparkline';
import { useProjectNavSeries } from '@/src/hooks/nav/useProjectNavSeries';
import { formatNaira } from '@/src/utils/currency';
import { formatUnits } from '@/src/utils/units';
import { CONTEXT_PANEL_WIDTH, useIsDesktop } from '@/src/constants/layout';

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
  projectId: string;
  raisedMinor: number;
  /** Paid drawdowns; current capital = raised - raiseFee - drawn */
  drawnMinor?: number;
  /** Accrued Prism raise fee reserved at target hit */
  raiseFeeMinor?: number;
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
  projectId,
  raisedMinor,
  drawnMinor = 0,
  raiseFeeMinor = 0,
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
  const isDesktop = useIsDesktop();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: navSeries } = useProjectNavSeries(isDesktop ? projectId : undefined);

  if (!isDesktop) return null;

  const raisedPct =
    targetMinor > 0 ? Math.min(100, Math.round((raisedMinor / targetMinor) * 100)) : 0;
  const currentCapitalMinor = Math.max(0, raisedMinor - raiseFeeMinor - drawnMinor);
  const currentPct =
    raisedMinor > 0 ? Math.min(100, Math.round((currentCapitalMinor / raisedMinor) * 100)) : 0;
  const committedPct = totalUnits > 0 ? Math.round((unitsCommitted / totalUnits) * 100) : 0;

  // Entry price + accumulated investor pool per unit = current net NAV
  const unitPriceMinor = totalUnits > 0 ? Math.round(targetMinor / totalUnits) : 0;
  const perUnitProfit = totalUnits > 0 ? Math.round(investorRealisedMinor / totalUnits) : 0;
  const navPerUnitMinor = unitPriceMinor + perUnitProfit;
  const navUpliftBps =
    unitPriceMinor > 0 ? Math.round((perUnitProfit / unitPriceMinor) * 10000) : 0;

  return (
    <ScrollView
      style={styles.panel}
      contentContainerStyle={styles.panelContent}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      testID="project-context-panel"
      {...(Platform.OS === 'web'
        ? ({ 'aria-label': 'Project context panel' } as Record<string, unknown>)
        : {})}
    >
      {/* Raised progress hero — cumulative subscriptions (never reduced by drawdowns) */}
      <Card interactive={false} elevated="sm" style={styles.card}>
        <HeroBalance
          label="CAPITAL RAISED"
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

      {/* Current capital — remaining after raise fee + paid drawdowns */}
      <Card interactive={false} elevated="sm" style={styles.card}>
        <HeroBalance
          label="CURRENT CAPITAL"
          valueMinor={currentCapitalMinor}
          size="md"
          subtitle={
            raiseFeeMinor > 0 || drawnMinor > 0
              ? [
                  raiseFeeMinor > 0 ? `${formatNaira(raiseFeeMinor)} raise fee` : null,
                  drawnMinor > 0 ? `${formatNaira(drawnMinor)} drawn` : null,
                  `${currentPct}% of raised remaining`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'No raise fee or drawdowns yet'
          }
        />
        {raiseFeeMinor > 0 || drawnMinor > 0 ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${currentPct}%`,
                  backgroundColor: palette.accent,
                },
              ]}
            />
          </View>
        ) : null}
      </Card>

      {raiseFeeMinor > 0 ? (
        <Card interactive={false} elevated="sm" style={styles.card}>
          <HeroBalance
            label="PRISM RAISE FEE"
            valueMinor={raiseFeeMinor}
            size="md"
            subtitle="Reserved when fundraising target was hit"
          />
        </Card>
      ) : null}

      {/* Unit register */}
      <Card interactive={false} elevated="sm" style={styles.card}>
        <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Unit Register</Text>
        <View style={styles.unitStack}>
          <UnitStatRow
            palette={palette}
            label="Taken"
            value={formatUnits(unitsCommitted)}
            emphasize
          />
          <View style={[styles.unitHairline, { backgroundColor: palette.border }]} />
          <UnitStatRow
            palette={palette}
            label="Available"
            value={formatUnits(unitsAvailable)}
          />
          <View style={[styles.unitHairline, { backgroundColor: palette.border }]} />
          <UnitStatRow palette={palette} label="Total book" value={formatUnits(totalUnits)} />
        </View>
        <View style={[styles.unitProgressTrack, { backgroundColor: palette.border }]}>
          <View
            style={[
              styles.unitProgressFill,
              {
                width: `${committedPct}%`,
                backgroundColor: committedPct >= 100 ? palette.semantic.success.fg : palette.primary,
              },
            ]}
          />
        </View>
        <Text style={[styles.unitMeta, { color: palette.textSecondary }]}>
          {committedPct}% of book placed
          {unitsAvailable > 0
            ? ` · ${formatUnits(unitsAvailable)} remaining`
            : ' · fully placed'}
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
              <View style={[styles.upliftPill, { backgroundColor: palette.semantic.success.bg }]}>
                <Feather name="trending-up" size={11} color={palette.semantic.success.fg} />
                <Text style={[styles.upliftText, { color: palette.semantic.success.fg }]}>
                  +{(navUpliftBps / 100).toFixed(2)}%
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.unitMeta, { color: palette.textSecondary }]}>
            Entry {formatNaira(unitPriceMinor)}
            {perUnitProfit > 0 ? ` · realised +${formatNaira(perUnitProfit)} / unit` : ''}
          </Text>
          {(navSeries?.length ?? 0) >= 2 ? (
            <View style={styles.navSparkWrap}>
              <MiniSparkline
                points={(navSeries ?? []).map((p) => p.navPerUnitMinor / 100)}
                color={navUpliftBps >= 0 ? palette.semantic.success.fg : palette.semantic.danger.fg}
                width={288}
                height={40}
                strokeWidth={1.8}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Meta */}
      <Card interactive={false} elevated="sm" style={styles.card}>
        <MetaRow palette={palette} icon="activity" label="Stage" value={humanStage(stage)} />
        <MetaRow
          palette={palette}
          icon="check-circle"
          label="Approval"
          value={humanApproval(approvalStatus)}
        />
        <MetaRow palette={palette} icon="users" label="Investors" value={String(investorCount)} />
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
    </ScrollView>
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

function UnitStatRow({
  palette,
  label,
  value,
  emphasize,
}: {
  palette: any;
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View style={styles.unitStatRow}>
      <Text style={[styles.unitLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.unitValue,
          tabularNums,
          { color: emphasize ? palette.primary : palette.text },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function humanStage(s: string): string {
  return (s || 'INITIATION')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanApproval(s: string): string {
  if (s === 'PENDING') return 'Awaiting CEO';
  if (s === 'APPROVED') return 'Approved';
  if (s === 'REJECTED') return 'Rejected';
  return s;
}

/** Hook: is the desktop split-layout available at the current viewport? */
export function useProjectSplitLayout() {
  return useIsDesktop();
}

const styles = StyleSheet.create({
  panel: {
    width: CONTEXT_PANEL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
    // Stretch to the split-row height so content can scroll instead of clipping.
    alignSelf: 'stretch',
    paddingLeft: spacing.md,
    ...(Platform.OS === 'web' ? ({ maxHeight: '100%' } as object) : null),
  },
  panelContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
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
  navSparkWrap: {
    marginTop: spacing.sm,
    height: 40,
    justifyContent: 'center',
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
  unitStack: {
    gap: spacing.sm,
  },
  unitStatRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  unitHairline: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  unitValue: {
    fontFamily: typography.families.display,
    fontSize: 22,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.3,
    lineHeight: 28,
    textAlign: 'right',
    flexShrink: 1,
  },
  unitLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  unitProgressTrack: {
    marginTop: spacing.md,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  unitProgressFill: {
    height: '100%',
    borderRadius: 999,
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
