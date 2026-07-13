import { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { StepIndicator } from '@/src/components/ui/StepIndicator';
import { Button } from '@/src/components/ui/Button';
import { useMockDataStore } from '@/src/store/useMockDataStore';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { colors, type ColorScheme } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { useUiStore } from '@/src/store/useUiStore';
import { typography } from '@/src/constants/typography';

const STEPS = ['Accept Terms', 'Commit', 'Payment', 'Confirmation'];
const QUICK_AMOUNTS = [
  { label: '₦250K', kobo: 25000000 },
  { label: '₦500K', kobo: 50000000 },
  { label: '₦1M', kobo: 100000000 },
  { label: 'Other', kobo: -1 },
];

export default function InvestFlowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const getProjectById = useMockDataStore((s) => s.getProjectById);
  const project = getProjectById(id ?? '');
  const [amountKobo, setAmountKobo] = useState(100000000);

  if (!project) {
    return null;
  }

  const projectedProfit = Math.round(amountKobo * (project.estimatedRoiPct / 100));
  const investorShare = (project.profitSplitInvestorBps / 100).toFixed(0);

  const inputStyle = [
    styles.input,
    { borderColor: palette.border, color: palette.text, backgroundColor: palette.surface },
  ];

  return (
    <ScreenLayout>
      <Text style={[styles.title, { color: palette.text }]}>Invest in Project</Text>
      <StepIndicator steps={STEPS} currentStep={2} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Investment Amount</Text>
        <TextInput
          style={inputStyle}
          value={String(amountKobo / 100)}
          onChangeText={(v) => setAmountKobo(nairaToKobo(Number(v.replace(/,/g, '')) || 0))}
          keyboardType="numeric"
          placeholder="Enter amount (₦)"
          placeholderTextColor={palette.muted}
        />

        <View style={styles.chips}>
          {QUICK_AMOUNTS.map((q) => {
            const selected = q.kobo === -1 ? false : amountKobo === q.kobo;
            return (
              <Pressable
                key={q.label}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? palette.primary : palette.surface,
                    borderColor: selected ? palette.primary : palette.border,
                  },
                ]}
                onPress={() => q.kobo !== -1 && setAmountKobo(q.kobo)}
              >
                <Text style={[styles.chipLabel, { color: selected ? '#FFF' : palette.text }]}>
                  {q.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            styles.summary,
            { backgroundColor: palette.primaryLight, borderColor: palette.border },
          ]}
        >
          <SummaryRow label="Your Investment" value={formatNaira(amountKobo)} palette={palette} />
          <SummaryRow
            label={`Projected Profit (${project.estimatedRoiPct}%)`}
            value={formatNaira(projectedProfit)}
            palette={palette}
          />
          <SummaryRow
            label="Est. Profit Share"
            value={`${investorShare}% of profit`}
            palette={palette}
          />
          <SummaryRow label="Est. Completion" value="Oct 2025" palette={palette} />
        </View>

        <View style={[styles.infoBox, { backgroundColor: '#EBF5FB', borderColor: '#D6EAF8' }]}>
          <Ionicons name="information-circle-outline" size={16} color="#2980B9" />
          <Text style={styles.infoText}>
            Returns are based on realised profit only. Your capital is at risk.
          </Text>
        </View>
      </ScrollView>

      <Button title="Continue to Payment" onPress={() => router.back()} />
      <Text style={[styles.footerNote, { color: palette.muted }]}>
        Secure · Shariah Compliant · Mudarabah
      </Text>
    </ScreenLayout>
  );
}

function SummaryRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: string;
  palette: (typeof colors)[ColorScheme];
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  scroll: { paddingBottom: spacing.md },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: typography.sizes.md,
    marginBottom: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLabel: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium },
  summary: { borderRadius: 12, borderWidth: 1, padding: spacing.sm, marginBottom: spacing.md },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: { fontSize: typography.sizes.xs },
  summaryValue: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  infoText: { flex: 1, fontSize: typography.sizes.xs, color: '#2980B9', lineHeight: 18 },
  footerNote: { fontSize: 10, textAlign: 'center', marginTop: spacing.sm },
});
