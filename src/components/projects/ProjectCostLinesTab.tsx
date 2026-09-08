import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
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
import { buildCsv, downloadCsv } from '@/src/utils/exportCsv';
import {
  getCostLineDocUrl,
  summarizeCostLines,
  uploadCostLineDoc,
  type CostLineClass,
  type CostLineDoc,
  type ProjectCostLine,
} from '@/src/services/costLines.services';
import {
  useCostLines,
  useCreateCostLine,
  useDeleteCostLine,
  useUpdateCostLine,
} from '@/src/hooks/costLines/useCostLines';
import { useFetchInvitesForProject } from '@/src/hooks/invitations/useFetchInvitesForProject';
import { fetchFundDrawdowns } from '@/src/services/projectOps.services';
import type { CostLineFormValues } from '@/src/schemas/costLine.schema';
import { costLineSchema } from '@/src/schemas/costLine.schema';

type Props = {
  projectId: string;
  canWrite: boolean;
};

const ALLOWED_DOC_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const EMPTY_FORM: CostLineFormValues = {
  occurredOn: new Date().toISOString().slice(0, 10),
  description: '',
  class: 'CAPEX',
  nature: 'ONE_TIME',
  quantity: 1,
  unitCostNaira: 0,
  annualFrequency: 1,
};

export function ProjectCostLinesTab({ projectId, canWrite }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const userId = useAuthStore((s) => s.user?.id ?? '');

  const { data: lines = [], isLoading, isError, error, refetch } = useCostLines(projectId);
  const { data: invites = [] } = useFetchInvitesForProject(projectId);
  const { data: drawdowns = [] } = useQuery({
    queryKey: ['drawdowns', projectId],
    queryFn: () => fetchFundDrawdowns(projectId),
    enabled: !!projectId,
  });

  const createLine = useCreateCostLine(projectId, userId);
  const updateLine = useUpdateCostLine(projectId);
  const deleteLine = useDeleteCostLine(projectId);

  const [query, setQuery] = useState('');
  const [klass, setKlass] = useState<'ALL' | CostLineClass>('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectCostLine | null>(null);
  const [form, setForm] = useState<CostLineFormValues>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [docAsset, setDocAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [removeDoc, setRemoveDoc] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

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

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, occurredOn: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setDocAsset(null);
    setRemoveDoc(false);
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
    setDocAsset(null);
    setRemoveDoc(false);
    setSheetOpen(true);
  };

  const pickDoc = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_DOC_MIME,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setDocAsset(result.assets[0]);
      setRemoveDoc(false);
    }
  };

  const openLineDoc = async (line: ProjectCostLine) => {
    if (!line.docStoragePath) return;
    try {
      setOpeningDocId(line.id);
      const url = await getCostLineDocUrl(line.docStoragePath);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      pushToast({ type: 'error', message: e instanceof Error ? e.message : 'Could not open document' });
    } finally {
      setOpeningDocId(null);
    }
  };

  const exportCsv = async () => {
    // Exports what's on screen: the active CAPEX/OPEX chip and search filter.
    const rows = filtered.map((l) => [
      l.occurredOn,
      l.description,
      l.class,
      l.nature === 'RECURRING' ? `Recurring x${l.annualFrequency}/yr` : 'One-time',
      l.quantity,
      koboToNaira(l.unitCostMinor),
      l.nature === 'RECURRING' ? l.annualFrequency : 1,
      koboToNaira(l.totalMinor),
      l.docFileName ?? '',
    ]);
    const totalMinor = filtered.reduce((sum, l) => sum + l.totalMinor, 0);
    rows.push(['', 'TOTAL', '', '', '', '', '', koboToNaira(totalMinor), '']);
    const csv = buildCsv(
      [
        'Date',
        'Description',
        'Class',
        'Nature',
        'Quantity',
        'Unit cost (NGN)',
        'Frequency / yr',
        'Line total (NGN)',
        'Document',
      ],
      rows,
    );
    const suffix = klass === 'ALL' ? 'all' : klass.toLowerCase();
    try {
      await downloadCsv(`cost-lines-${suffix}.csv`, csv);
    } catch (e) {
      pushToast({ type: 'error', message: e instanceof Error ? e.message : 'Export failed' });
    }
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
      // undefined = leave existing doc untouched, null = detach it
      let doc: CostLineDoc | null | undefined;
      if (docAsset) {
        setUploadingDoc(true);
        try {
          doc = await uploadCostLineDoc(projectId, {
            uri: docAsset.uri,
            name: docAsset.name,
            mimeType: docAsset.mimeType,
          });
        } finally {
          setUploadingDoc(false);
        }
      } else if (removeDoc) {
        doc = null;
      }

      if (editing) {
        await updateLine.mutateAsync({ id: editing.id, values: parsed.data, doc });
      } else {
        await createLine.mutateAsync({ values: parsed.data, doc });
      }
      setSheetOpen(false);
      pushToast({ type: 'success', message: editing ? 'Cost line updated' : 'Cost line added' });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
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
        {filtered.length > 0 ? (
          <Button
            title="Export CSV"
            size="sm"
            variant="outline"
            onPress={() => void exportCsv()}
          />
        ) : null}
      </View>

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
            {line.docStoragePath ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open document ${line.docFileName ?? ''}`}
                onPress={() => void openLineDoc(line)}
                hitSlop={8}
                style={{ padding: 6 }}
              >
                {openingDocId === line.id ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Ionicons name="document-attach-outline" size={16} color={palette.primary} />
                )}
              </Pressable>
            ) : null}
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
              <Pressable
                onPress={() => void pickDoc()}
                style={[styles.filePicker, { borderColor: palette.border }]}
                accessibilityRole="button"
                accessibilityLabel="Attach supporting document"
              >
                <Ionicons name="cloud-upload-outline" size={18} color={palette.primary} />
                <Text style={[styles.fileText, { color: palette.text }]} numberOfLines={1}>
                  {docAsset
                    ? docAsset.name
                    : editing?.docFileName && !removeDoc
                      ? editing.docFileName
                      : 'Attach receipt or invoice (optional)'}
                </Text>
                {docAsset || (editing?.docFileName && !removeDoc) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove attached document"
                    hitSlop={8}
                    onPress={() => {
                      setDocAsset(null);
                      setRemoveDoc(true);
                    }}
                  >
                    <Ionicons name="close-circle" size={18} color={palette.muted} />
                  </Pressable>
                ) : null}
              </Pressable>
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
                loading={uploadingDoc || createLine.isPending || updateLine.isPending}
                onPress={() => void saveLine()}
              />
            </ScrollView>
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
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  fileText: { flex: 1, fontSize: typography.sizes.sm },
});
