import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { ChipRow } from '@/src/components/ui/ChipRow';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { formatNaira, koboToNaira } from '@/src/utils/currency';
import { formatDate } from '@/src/utils/date';
import { formatUnits } from '@/src/utils/units';
import {
  summarizeCostLines,
  type CostLineClass,
  type ProjectCostLine,
} from '@/src/services/costLines.services';
import {
  useCostLines,
  useCreateCostLine,
  useDeleteCostLine,
  useUpdateCostLine,
} from '@/src/hooks/costLines/useCostLines';
import {
  useFundingRounds,
  useRequestFundingRound,
} from '@/src/hooks/fundingRounds/useFundingRounds';
import { useFetchInvitesForProject } from '@/src/hooks/invitations/useFetchInvitesForProject';
import { useCreateInvite } from '@/src/hooks/invitations/useCreateInvite';
import { fetchFundDrawdowns } from '@/src/services/projectOps.services';
import type { CostLineFormValues } from '@/src/schemas/costLine.schema';
import { costLineSchema } from '@/src/schemas/costLine.schema';

type Props = {
  projectId: string;
  canWrite: boolean;
  canRequestRound: boolean;
  canInvite: boolean;
  unitPriceMinor: number;
};

const EMPTY_FORM: CostLineFormValues = {
  occurredOn: new Date().toISOString().slice(0, 10),
  description: '',
  class: 'CAPEX',
  nature: 'ONE_TIME',
  quantity: 1,
  unitCostNaira: 0,
  annualFrequency: 1,
};

export function ProjectCostLinesTab({
  projectId,
  canWrite,
  canRequestRound,
  canInvite,
  unitPriceMinor,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const userId = useAuthStore((s) => s.user?.id ?? '');

  const { data: lines = [], isLoading, isError, error, refetch } = useCostLines(projectId);
  const { data: rounds = [] } = useFundingRounds(projectId);
  const { data: invites = [] } = useFetchInvitesForProject(projectId);
  const { data: drawdowns = [] } = useQuery({
    queryKey: ['drawdowns', projectId],
    queryFn: () => fetchFundDrawdowns(projectId),
    enabled: !!projectId,
  });

  const createLine = useCreateCostLine(projectId, userId);
  const updateLine = useUpdateCostLine(projectId);
  const deleteLine = useDeleteCostLine(projectId);
  const requestRound = useRequestFundingRound(projectId);
  const createInvite = useCreateInvite(projectId);

  const [query, setQuery] = useState('');
  const [klass, setKlass] = useState<'ALL' | CostLineClass>('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectCostLine | null>(null);
  const [form, setForm] = useState<CostLineFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [roundOpen, setRoundOpen] = useState(false);
  const [roundUnits, setRoundUnits] = useState('');
  const [roundReason, setRoundReason] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const summary = useMemo(() => summarizeCostLines(lines), [lines]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lines.filter((l) => {
      if (klass !== 'ALL' && l.class !== klass) return false;
      if (q && !l.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lines, query, klass]);

  const inflows = useMemo(
    () =>
      invites
        .filter((i) => i.status === 'CONFIRMED')
        .map((i) => ({
          id: i.id,
          date: i.verifiedAt ?? i.pledgedAt,
          label: i.investorName || i.email || 'Investor',
          amount: i.amountMinor ?? 0,
          detail: i.unitsAllotted ? `${formatUnits(i.unitsAllotted)} units` : undefined,
        })),
    [invites],
  );

  const capitalOut = useMemo(
    () =>
      drawdowns
        .filter((d) => d.status === 'PAID' || d.status === 'APPROVED')
        .map((d) => ({
          id: d.id,
          date: d.createdAt,
          label: d.purpose,
          amount: d.amountMinor,
          detail: d.status,
        })),
    [drawdowns],
  );

  const approvedRound = rounds.find((r) => r.status === 'APPROVED');
  const pendingRound = rounds.find((r) => r.status === 'PENDING');

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, occurredOn: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (line: ProjectCostLine) => {
    setEditing(line);
    setForm({
      occurredOn: line.occurredOn,
      description: line.description,
      class: line.class,
      nature: line.nature,
      quantity: line.quantity,
      unitCostNaira: koboToNaira(line.unitCostMinor),
      annualFrequency: line.annualFrequency,
    });
    setFormError(null);
    setSheetOpen(true);
  };

  const saveLine = async () => {
    const parsed = costLineSchema.safeParse({
      ...form,
      annualFrequency: form.nature === 'ONE_TIME' ? 1 : form.annualFrequency,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    try {
      if (editing) {
        await updateLine.mutateAsync({ id: editing.id, values: parsed.data });
      } else {
        await createLine.mutateAsync(parsed.data);
      }
      setSheetOpen(false);
      pushToast({ type: 'success', message: editing ? 'Cost line updated' : 'Cost line added' });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const submitRound = async () => {
    const units = Number(roundUnits);
    if (!Number.isInteger(units) || units <= 0) {
      pushToast({ type: 'error', message: 'Enter a whole number of additional units.' });
      return;
    }
    if (roundReason.trim().length < 5) {
      pushToast({ type: 'error', message: 'Explain why this capital is needed (5+ characters).' });
      return;
    }
    try {
      await requestRound.mutateAsync({
        additionalUnits: units,
        reason: roundReason.trim(),
        costLineIds: lines.map((l) => l.id),
      });
      setRoundOpen(false);
      setRoundUnits('');
      setRoundReason('');
      pushToast({ type: 'success', message: 'Additional capital requested — awaiting CEO approval.' });
    } catch (e) {
      pushToast({ type: 'error', message: e instanceof Error ? e.message : 'Request failed' });
    }
  };

  if (isLoading) {
    return <Text style={{ color: palette.muted, padding: spacing.md }}>Loading cost lines…</Text>;
  }
  if (isError) {
    return (
      <EmptyState
        title="Could not load cost lines"
        message={error instanceof Error ? error.message : 'Try again'}
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    );
  }

  const previewTotal =
    Number(form.quantity || 0) *
    Number(form.unitCostNaira || 0) *
    (form.nature === 'ONE_TIME' ? 1 : Number(form.annualFrequency || 1));

  return (
    <View>
      <Text style={[styles.kicker, { color: palette.muted }]}>02 Cost lines</Text>
      <Text style={[styles.lede, { color: palette.textSecondary }]}>
        Every line tells the story behind the ask.
      </Text>

      <View style={[styles.summaryBar, { borderColor: palette.border }]}>
        <View style={[styles.summaryHero, { backgroundColor: palette.text }]}>
          <Text style={styles.summaryHeroLabel}>TOTAL REQUEST</Text>
          <Text style={[styles.summaryHeroValue, { color: palette.accent }]}>
            {formatNaira(summary.totalMinor, false)}
          </Text>
          <Text style={styles.summaryHeroSub}>across {summary.count} cost lines</Text>
        </View>
        <SummaryCell
          dot={palette.success}
          label="CAPEX"
          value={formatNaira(summary.capexMinor, false)}
          palette={palette}
        />
        <SummaryCell
          dot={palette.warning}
          label="OPEX"
          value={formatNaira(summary.opexMinor, false)}
          palette={palette}
        />
        <SummaryCell
          dot={palette.accent}
          label="Annual recurring OPEX"
          value={formatNaira(summary.recurringOpexMinor, false)}
          palette={palette}
        />
      </View>

      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}>
          <TextInput
            label="Scan cost lines"
            value={query}
            onChangeText={setQuery}
            placeholder="Search description"
          />
        </View>
      </View>
      <ChipRow
        chips={[
          { key: 'ALL', label: 'All', count: lines.length },
          { key: 'CAPEX', label: 'CAPEX' },
          { key: 'OPEX', label: 'OPEX' },
        ]}
        activeKey={klass}
        onChange={(k) => setKlass(k as 'ALL' | CostLineClass)}
      />

      <View style={styles.actions}>
        {canWrite ? (
          <Button title="+ Add cost line" size="sm" onPress={openCreate} />
        ) : null}
        {canRequestRound && !pendingRound ? (
          <Button
            title="Request additional capital"
            size="sm"
            variant="outline"
            onPress={() => setRoundOpen(true)}
          />
        ) : null}
      </View>
      {pendingRound ? (
        <Text style={[styles.helper, { color: palette.warning }]}>
          A raise of {formatUnits(pendingRound.additionalUnits)} units is awaiting CEO approval.
        </Text>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState title="No cost lines yet" message="Log CAPEX and OPEX against this project." />
      ) : (
        filtered.map((line) => (
          <Pressable
            key={line.id}
            style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}
            onPress={canWrite ? () => openEdit(line) : undefined}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>{line.description}</Text>
              <Text style={[styles.rowMeta, { color: palette.textSecondary }]}>
                {formatDate(line.occurredOn)} · {line.class} ·{' '}
                {line.nature === 'RECURRING' ? `Recurring ×${line.annualFrequency}/yr` : 'One-time'}
              </Text>
            </View>
            <Text style={[styles.rowTotal, { color: palette.text }]}>
              {formatNaira(line.totalMinor, false)}
            </Text>
            {canWrite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete cost line"
                onPress={() => deleteLine.mutate(line.id)}
                hitSlop={8}
                style={{ padding: 6 }}
              >
                <Ionicons name="trash-outline" size={16} color={palette.error} />
              </Pressable>
            ) : null}
          </Pressable>
        ))
      )}
      <Text style={[styles.formula, { color: palette.muted }]}>
        Total = quantity × unit cost × annual frequency. One-time costs use a frequency of 1.
      </Text>

      <Text style={[styles.section, { color: palette.text }]}>Inflows (confirmed investments)</Text>
      <Text style={[styles.lede, { color: palette.textSecondary }]}>
        Capital in is recorded when an invitation is confirmed — never typed in by hand.
      </Text>
      {inflows.length === 0 ? (
        <Text style={[styles.helper, { color: palette.muted }]}>No confirmed investments yet.</Text>
      ) : (
        inflows.map((row) => (
          <View
            key={row.id}
            style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>{row.label}</Text>
              <Text style={[styles.rowMeta, { color: palette.textSecondary }]}>
                {row.date ? formatDate(row.date) : '—'}
                {row.detail ? ` · ${row.detail}` : ''}
              </Text>
            </View>
            <Text style={[styles.rowTotal, { color: palette.success }]}>
              +{formatNaira(row.amount, false)}
            </Text>
          </View>
        ))
      )}

      <Text style={[styles.section, { color: palette.text }]}>Capital remitted (drawdowns)</Text>
      {capitalOut.length === 0 ? (
        <Text style={[styles.helper, { color: palette.muted }]}>No remitted drawdowns.</Text>
      ) : (
        capitalOut.map((row) => (
          <View
            key={row.id}
            style={[styles.row, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: palette.text }]}>{row.label}</Text>
              <Text style={[styles.rowMeta, { color: palette.textSecondary }]}>
                {formatDate(row.date)} · {row.detail}
              </Text>
            </View>
            <Text style={[styles.rowTotal, { color: palette.error }]}>
              −{formatNaira(row.amount, false)}
            </Text>
          </View>
        ))
      )}

      {canInvite && approvedRound ? (
        <View style={[styles.inviteBox, { borderColor: palette.border }]}>
          <Text style={[styles.section, { color: palette.text, marginTop: 0 }]}>
            Invite into approved raise
          </Text>
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            {formatUnits(approvedRound.additionalUnits)} additional units at{' '}
            {formatNaira(approvedRound.unitPriceMinor)} / unit. Existing investors get a new
            invite row and go through pledge → proof → confirmation as usual.
          </Text>
          <TextInput
            label="Investor email"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            title="Send invitation"
            size="sm"
            loading={createInvite.isPending}
            onPress={() => void (async () => {
              try {
                await createInvite.mutateAsync({
                  email: inviteEmail.trim(),
                  roundId: approvedRound.id,
                });
                setInviteEmail('');
                pushToast({ type: 'success', message: 'Invitation sent' });
              } catch (e) {
                pushToast({
                  type: 'error',
                  message: e instanceof Error ? e.message : 'Invite failed',
                });
              }
            })()}
          />
        </View>
      ) : null}

      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSheetOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: palette.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView>
              <Text style={[styles.section, { color: palette.text, marginTop: 0 }]}>
                {editing ? 'Edit cost line' : 'Add cost line'}
              </Text>
              <TextInput
                label="Date (YYYY-MM-DD)"
                value={form.occurredOn}
                onChangeText={(occurredOn) => setForm((f) => ({ ...f, occurredOn }))}
              />
              <TextInput
                label="Description"
                value={form.description}
                onChangeText={(description) => setForm((f) => ({ ...f, description }))}
              />
              <ChipRow
                chips={[
                  { key: 'CAPEX', label: 'CAPEX' },
                  { key: 'OPEX', label: 'OPEX' },
                ]}
                activeKey={form.class}
                onChange={(k) => setForm((f) => ({ ...f, class: k as CostLineClass }))}
              />
              <View style={{ height: spacing.sm }} />
              <ChipRow
                chips={[
                  { key: 'ONE_TIME', label: 'One-time' },
                  { key: 'RECURRING', label: 'Recurring' },
                ]}
                activeKey={form.nature}
                onChange={(k) =>
                  setForm((f) => ({
                    ...f,
                    nature: k as CostLineFormValues['nature'],
                    annualFrequency: k === 'ONE_TIME' ? 1 : f.annualFrequency,
                  }))
                }
              />
              <TextInput
                label="Quantity"
                value={String(form.quantity ?? '')}
                onChangeText={(t) => setForm((f) => ({ ...f, quantity: Number(t) || 0 }))}
                keyboardType="decimal-pad"
              />
              <TextInput
                label="Unit cost (₦)"
                value={String(form.unitCostNaira ?? '')}
                onChangeText={(t) => setForm((f) => ({ ...f, unitCostNaira: Number(t) || 0 }))}
                keyboardType="decimal-pad"
              />
              {form.nature === 'RECURRING' ? (
                <TextInput
                  label="Frequency / yr"
                  value={String(form.annualFrequency ?? '')}
                  onChangeText={(t) => setForm((f) => ({ ...f, annualFrequency: Number(t) || 1 }))}
                  keyboardType="number-pad"
                />
              ) : null}
              <Text style={[styles.helper, { color: palette.textSecondary }]}>
                Line total: {formatNaira(Math.round(previewTotal * 100), false)}
              </Text>
              {formError ? (
                <Text style={[styles.helper, { color: palette.error }]}>{formError}</Text>
              ) : null}
              <Button
                title={editing ? 'Save' : 'Add'}
                loading={createLine.isPending || updateLine.isPending}
                onPress={() => void saveLine()}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={roundOpen} transparent animationType="fade" onRequestClose={() => setRoundOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setRoundOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: palette.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.section, { color: palette.text, marginTop: 0 }]}>
              Request additional capital
            </Text>
            <Text style={[styles.helper, { color: palette.textSecondary }]}>
              Units are minted at the existing unit price
              {unitPriceMinor ? ` (${formatNaira(unitPriceMinor)} each)` : ''}. CEO approval
              updates the project target; invitations then reuse the normal payment flow.
            </Text>
            <TextInput
              label="Additional units"
              value={roundUnits}
              onChangeText={setRoundUnits}
              keyboardType="number-pad"
            />
            <TextInput
              label="Reason"
              value={roundReason}
              onChangeText={setRoundReason}
              multiline
            />
            <Button
              title="Submit for CEO approval"
              loading={requestRound.isPending}
              onPress={() => void submitRound()}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function SummaryCell({
  dot,
  label,
  value,
  palette,
}: {
  dot: string;
  label: string;
  value: string;
  palette: (typeof colors)['light'];
}) {
  return (
    <View style={styles.summaryCell}>
      <View style={styles.summaryLabelRow}>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={[styles.summaryLabel, { color: palette.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: typography.sizes.sm, fontWeight: '700', letterSpacing: 0.4 },
  lede: { fontSize: typography.sizes.sm, fontStyle: 'italic', marginBottom: spacing.md },
  summaryBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  summaryHero: { padding: spacing.md, minWidth: 160, flexGrow: 1 },
  summaryHeroLabel: { color: '#fff', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  summaryHeroValue: { fontSize: 22, fontWeight: '800', marginVertical: 4, ...tabularNums },
  summaryHeroSub: { color: '#cfcfcf', fontSize: 11 },
  summaryCell: { padding: spacing.md, minWidth: 120, flexGrow: 1 },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  summaryLabel: { fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  summaryValue: { fontSize: 16, fontWeight: '700', marginTop: 6, ...tabularNums },
  toolbar: { marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md, flexWrap: 'wrap' },
  helper: { fontSize: typography.sizes.sm, marginBottom: spacing.sm },
  formula: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.lg },
  section: { fontSize: typography.sizes.md, fontWeight: '700', marginTop: spacing.lg, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowTitle: { fontWeight: '600' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowTotal: { fontWeight: '700', ...tabularNums },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: { borderRadius: radii.md, padding: spacing.md, maxHeight: '90%' },
  inviteBox: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.lg },
});
