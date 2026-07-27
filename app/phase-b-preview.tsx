import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { Button } from '@/src/components/ui/Button';
import { Card } from '@/src/components/ui/Card';
import { ChipRow } from '@/src/components/ui/ChipRow';
import { HeroBalance } from '@/src/components/ui/HeroBalance';
import { ActionPillGroup } from '@/src/components/ui/ActionPillGroup';
import { SparklineTile } from '@/src/components/ui/SparklineTile';
import { DistributionNoticeCard } from '@/src/components/ui/DistributionNoticeCard';
import { PrismLoader } from '@/src/components/ui/PrismLoader';

/**
 * Phase B component preview — internal QA page. Not linked from any nav.
 * Access at /_phase-b. Shows every Prism Capital shared component in one
 * place so the design pass can be visually reviewed before rolling into
 * customer-facing screens (Phases C-E).
 */
export default function PhaseBPreview() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const [chip, setChip] = useState('all');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={styles.container}
    >
      {/* Header */}
      <View style={styles.section}>
        <Text style={[styles.h1, { color: palette.text }]}>Phase B — Shared Components</Text>
        <Text style={[styles.h2, { color: palette.textSecondary }]}>
          Institutional design system · Blue palette · Instrument Serif
        </Text>
      </View>

      {/* HeroBalance */}
      <View style={styles.section}>
        <SectionTitle text="HeroBalance" palette={palette} />
        <Card>
          <HeroBalance
            label="TOTAL INVESTED"
            valueMinor={2_450_000_00}
            delta={{ label: '₦120,000 this month', direction: 'up' }}
            subtitle="as of 27 Jul 2026"
          />
        </Card>
        <Card>
          <HeroBalance
            label="AVAILABLE BALANCE"
            valueMinor={87_500_00}
            size="md"
            align="left"
          />
        </Card>
      </View>

      {/* Buttons */}
      <View style={styles.section}>
        <SectionTitle text="Button — variants & shapes" palette={palette} />
        <Card>
          <View style={styles.btnGrid}>
            <Button title="Primary" variant="primary" />
            <Button title="Secondary" variant="secondary" />
            <Button title="Soft" variant="soft" />
            <Button title="Outline" variant="outline" />
            <Button title="Ghost" variant="ghost" />
            <Button title="Danger" variant="danger" />
          </View>
          <View style={[styles.btnGrid, { marginTop: spacing.md }]}>
            <Button
              title="Continue"
              variant="primary"
              shape="pill"
              rightIcon={<Feather name="arrow-right" size={16} color="#FFF" />}
            />
            <Button
              title="With icon"
              variant="soft"
              leftIcon={<Feather name="download" size={16} color={palette.brand[700]} />}
            />
            <Button title="Loading…" variant="primary" loading />
            <Button title="Disabled" variant="primary" disabled />
          </View>
        </Card>
      </View>

      {/* ChipRow */}
      <View style={styles.section}>
        <SectionTitle text="ChipRow" palette={palette} />
        <Card>
          <ChipRow
            activeKey={chip}
            onChange={setChip}
            chips={[
              { key: 'all', label: 'All', count: 12 },
              { key: 'active', label: 'Active', count: 4 },
              { key: 'pledged', label: 'Pledged', count: 3 },
              { key: 'settled', label: 'Settled' },
              { key: 'archived', label: 'Archived' },
            ]}
          />
        </Card>
      </View>

      {/* ActionPillGroup */}
      <View style={styles.section}>
        <SectionTitle text="ActionPillGroup" palette={palette} />
        <Card>
          <ActionPillGroup
            actions={[
              { key: 'browse', label: 'Browse', icon: 'search', primary: true },
              { key: 'invest', label: 'Invest', icon: 'trending-up' },
              { key: 'withdraw', label: 'Withdraw', icon: 'arrow-up-right' },
              { key: 'statements', label: 'Statements', icon: 'file-text' },
            ]}
          />
        </Card>
      </View>

      {/* SparklineTile */}
      <View style={styles.section}>
        <SectionTitle text="SparklineTile" palette={palette} />
        <View style={styles.grid2}>
          <SparklineTile
            label="MONTHLY YIELD"
            value="₦2.4M"
            meta="of ₦5M target"
            delta={{ label: '12.6%', direction: 'up' }}
            tone="success"
            points={[10, 12, 11, 14, 13, 17, 20, 19, 22, 24, 23, 27]}
            style={styles.gridChild}
          />
          <SparklineTile
            label="DEPLOYED CAPITAL"
            value="₦48.2M"
            delta={{ label: '3.1%', direction: 'down' }}
            tone="brand"
            points={[50, 48, 52, 47, 45, 46, 44, 42, 43, 41, 45, 48]}
            style={styles.gridChild}
          />
        </View>
      </View>

      {/* DistributionNoticeCard */}
      <View style={styles.section}>
        <SectionTitle text="DistributionNoticeCard" palette={palette} />
        <DistributionNoticeCard
          reference="PRSM-ALPHA-NOT007"
          projectName="Prism Alpha Fund"
          amountMinor={1_250_000_00}
          postedAt="2026-07-15"
          period="Q2 2026"
          onDownload={() => {}}
        />
        <DistributionNoticeCard
          reference="PRSM-BETA-NOT002"
          projectName="Northgate Real Estate Cohort II"
          amountMinor={480_000_00}
          postedAt="2026-06-30"
          period="Jun 2026"
          onDownload={() => {}}
          downloaded
        />
      </View>

      {/* Card tones */}
      <View style={styles.section}>
        <SectionTitle text="Card — tonal accents" palette={palette} />
        <Card tone="default">
          <Text style={{ color: palette.text, fontWeight: '600' }}>Default surface</Text>
          <Text style={{ color: palette.textSecondary, marginTop: 4, fontSize: 13 }}>
            Neutral card for most content.
          </Text>
        </Card>
        <Card tone="brand">
          <Text style={{ color: palette.brand[700], fontWeight: '600' }}>Brand tint</Text>
          <Text style={{ color: palette.brand[700], marginTop: 4, fontSize: 13, opacity: 0.85 }}>
            Used for callouts and CTAs.
          </Text>
        </Card>
        <Card tone="success">
          <Text style={{ color: palette.semantic.success.fg, fontWeight: '600' }}>Positive tone</Text>
          <Text style={{ color: palette.semantic.success.fg, marginTop: 4, fontSize: 13, opacity: 0.85 }}>
            Confirmations, verified states, growth signals.
          </Text>
        </Card>
        <Card tone="warning">
          <Text style={{ color: palette.semantic.warning.fg, fontWeight: '600' }}>Warning tone</Text>
          <Text style={{ color: palette.semantic.warning.fg, marginTop: 4, fontSize: 13, opacity: 0.85 }}>
            Awaiting action, pending verification.
          </Text>
        </Card>
        <Card tone="danger">
          <Text style={{ color: palette.semantic.danger.fg, fontWeight: '600' }}>Critical tone</Text>
          <Text style={{ color: palette.semantic.danger.fg, marginTop: 4, fontSize: 13, opacity: 0.85 }}>
            Rejections, failed reconciliations, blocking errors.
          </Text>
        </Card>
      </View>

      {/* PrismLoader */}
      <View style={styles.section}>
        <SectionTitle text="PrismLoader — signature loading indicator" palette={palette} />
        <Card>
          <View style={styles.loaderRow}>
            <View style={styles.loaderCell}>
              <PrismLoader size="sm" />
              <Text style={[styles.loaderLabel, { color: palette.textSecondary }]}>sm</Text>
            </View>
            <View style={styles.loaderCell}>
              <PrismLoader size="md" />
              <Text style={[styles.loaderLabel, { color: palette.textSecondary }]}>md</Text>
            </View>
            <View style={styles.loaderCell}>
              <PrismLoader size="lg" />
              <Text style={[styles.loaderLabel, { color: palette.textSecondary }]}>lg</Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}

function SectionTitle({ text, palette }: { text: string; palette: any }) {
  return (
    <Text
      style={{
        color: palette.textSecondary,
        fontSize: typography.sizes.xs,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: spacing.sm,
      }}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: spacing.xl,
  },
  h1: {
    fontFamily: typography.families.display,
    fontSize: 44,
    fontWeight: '500',
    letterSpacing: -1,
    lineHeight: 48,
    marginBottom: 4,
  },
  h2: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    letterSpacing: -0.1,
    marginBottom: spacing.lg,
  },
  btnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  grid2: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
    flexWrap: 'wrap',
  },
  gridChild: {
    flex: 1,
    minWidth: 260,
    marginBottom: 0,
  },
  loaderRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  loaderCell: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loaderLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
