import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { ConfirmSheet } from '@/src/components/ui/ConfirmSheet';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { previewWaterfall } from '@/src/services/profitDeclarations.services';
import {
  useApproveDeclaration,
  useDeclareProfit,
  useProjectDeclarations,
  useRejectDeclaration,
} from '@/src/hooks/profits/useProfitDeclarations';
import { useSession } from '@/src/hooks/auth/useSession';
import moment from 'moment';

type Props = {
  projectId: string;
  projectStage: 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
  canDeclare: boolean; // LM only, project in PROGRESS
  canApprove: boolean; // CEO/Admin
  platformFeeBps: number;
  profitSplitInvestorBps: number;
  totalUnits: number;
  confirmedInvestorCount?: number;
  onChanged?: () => void;
};

function confirmDialog(msg: string, onOk: () => void, onCancelText = 'Cancel') {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(msg)) onOk();
    return;
  }
  Alert.alert('Confirm', msg, [
    { text: onCancelText, style: 'cancel' },
    { text: 'Continue', style: 'destructive', onPress: onOk },
  ]);
}

export function ProjectProfitsTab({
  projectId,
  projectStage,
  canDeclare,
  canApprove,
  platformFeeBps,
  profitSplitInvestorBps,
  totalUnits,
  confirmedInvestorCount = 0,
  onChanged,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const { user } = useSession();

  const [gross, setGross] = useState('');
  const [costs, setCosts] = useState('');
  const [label, setLabel] = useState('');
  const [approvalTarget, setApprovalTarget] = useState<{ id: string; ref: string } | null>(null);

  const { data: declarations = [], isLoading } = useProjectDeclarations(projectId);
  const declare = useDeclareProfit(projectId);
  const approve = useApproveDeclaration();
  const reject = useRejectDeclaration();

  const grossKobo = gross ? nairaToKobo(parseFloat(gross) || 0) : 0;
  const costsKobo = costs ? nairaToKobo(parseFloat(costs) || 0) : 0;

  const preview = useMemo(
    () =>
      previewWaterfall({
        grossMinor: grossKobo,
        costsMinor: costsKobo,
        platformFeeBps,
        profitSplitInvestorBps,
        totalUnits,
      }),
    [grossKobo, costsKobo, platformFeeBps, profitSplitInvestorBps, totalUnits],
  );

  const submit = async (isFinal: boolean) => {
    if (grossKobo <= 0) {
      pushToast({ type: 'error', message: 'Gross profit must be greater than zero.' });
      return;
    }
    if (costsKobo > grossKobo) {
      pushToast({ type: 'error', message: 'Costs cannot exceed gross.' });
      return;
    }
    const doIt = async () => {
      try {
        await declare.mutateAsync({
          projectId,
          grossMinor: grossKobo,
          costsMinor: costsKobo,
          label: label || undefined,
          isFinal,
        });
        pushToast({
          type: 'success',
          message: isFinal
            ? 'Final declaration submitted for approval.'
            : 'Declaration submitted for approval.',
        });
        setGross('');
        setCosts('');
        setLabel('');
        onChanged?.();
      } catch (err) {
        pushToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to submit declaration.',
        });
      }
    };
    if (isFinal) {
      confirmDialog(
        `End project and distribute ${formatNaira(preview.investorPool)} to ${confirmedInvestorCount} investor${confirmedInvestorCount === 1 ? '' : 's'} (${formatNaira(preview.perUnit)}/unit)?\n\nThis submits a FINAL declaration for CEO approval. Once approved, the project stage moves to END and no further updates can be posted.`,
        doIt,
      );
    } else {
      doIt();
    }
  };

  const doApprove = (id: string, ref: string) => {
    // Open the ConfirmSheet — actual approve happens on confirm.
    setApprovalTarget({ id, ref });
  };

  const performApprove = async () => {
    if (!approvalTarget) return;
    const { id, ref } = approvalTarget;
    try {
      await approve.mutateAsync(id);
      pushToast({
        type: 'success',
        message: 'Declaration approved — waterfall released.',
        reference: ref,
      });
      onChanged?.();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Approval failed.',
      });
    } finally {
      setApprovalTarget(null);
    }
  };

  const doReject = (id: string, ref: string) => {
    if (Platform.OS !== 'web') return;
    const note = typeof window !== 'undefined' ? window.prompt(`Reason for rejecting ${ref}?`) : '';
    if (note === null) return;
    (async () => {
      try {
        await reject.mutateAsync({ id, note });
        pushToast({ type: 'success', message: `Rejected ${ref}.` });
        onChanged?.();
      } catch (err) {
        pushToast({
          type: 'error',
          message: err instanceof Error ? err.message : 'Rejection failed.',
        });
      }
    })();
  };

  const targetDecl = useMemo(
    () => (approvalTarget ? declarations.find((d) => d.id === approvalTarget.id) : null),
    [approvalTarget, declarations],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ConfirmSheet
        open={!!approvalTarget}
        onClose={() => setApprovalTarget(null)}
        onConfirm={performApprove}
        title={targetDecl?.isFinal ? 'Approve FINAL declaration' : 'Approve declaration'}
        message={
          targetDecl?.isFinal
            ? "This will release the waterfall AND close the project. Capital + profit will be distributed and the stage flips to END. Once approved, no further updates can be posted."
            : "This releases funds through the full waterfall to investors, the manager, and Prism Capital. Immutable once approved."
        }
        details={
          targetDecl
            ? [
                { label: 'Reference', value: targetDecl.reference, emphasize: true },
                { label: 'Gross', value: formatNaira(targetDecl.grossMinor) },
                { label: 'Costs', value: `– ${formatNaira(targetDecl.costsMinor)}` },
                { label: 'Net profit', value: formatNaira(targetDecl.netMinor) },
                { label: 'Prism fee', value: `– ${formatNaira(targetDecl.platformFeeMinor)}` },
                { label: 'Manager share', value: formatNaira(targetDecl.managerShareMinor) },
                { label: 'Investor pool', value: formatNaira(targetDecl.investorPoolMinor), emphasize: true },
                { label: 'Per unit', value: formatNaira(targetDecl.perUnitMinor) },
              ]
            : []
        }
        typedConfirmation={targetDecl?.isFinal ? 'END' : undefined}
        checkboxMessage={
          targetDecl?.isFinal
            ? undefined
            : 'I confirm this waterfall is correct and I am authorized to approve.'
        }
        confirmLabel={targetDecl?.isFinal ? 'Approve & end project' : 'Approve declaration'}
        destructive={!!targetDecl?.isFinal}
        loading={approve.isPending}
        data-testid="confirm-approve-declaration"
      />

      {/* Waterfall preview + declaration form (LM only, PROGRESS only) */}
      {canDeclare && projectStage === 'PROGRESS' && (
        <View
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.h2, { color: palette.text }]}>Declare profit</Text>
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            Enter gross profit and costs. The waterfall is calculated live below and locked when
            you submit for approval.
          </Text>
          <TextInput
            label="Label (optional, e.g. H2 2027)"
            value={label}
            onChangeText={setLabel}
            data-testid="declaration-label"
          />
          <TextInput
            label="Gross profit (₦)"
            value={gross}
            onChangeText={setGross}
            keyboardType="decimal-pad"
            data-testid="declaration-gross"
          />
          <TextInput
            label="Deductible costs (₦)"
            value={costs}
            onChangeText={setCosts}
            keyboardType="decimal-pad"
            data-testid="declaration-costs"
          />

          {/* Waterfall preview */}
          <View style={[styles.waterfall, { borderColor: palette.border }]}>
            <WaterfallRow palette={palette} label="Gross" value={preview.gross} />
            <WaterfallRow palette={palette} label="– Costs" value={-preview.costs} />
            <WaterfallRow palette={palette} label="= Net" value={preview.net} strong />
            <WaterfallRow
              palette={palette}
              label={`– Prism fee (${(platformFeeBps / 100).toFixed(1)}%)`}
              value={-preview.platformFee}
            />
            <WaterfallRow palette={palette} label="= Distributable" value={preview.distributable} />
            <WaterfallRow
              palette={palette}
              label={`Investor pool (${(profitSplitInvestorBps / 100).toFixed(0)}%)`}
              value={preview.investorPool}
              highlight={palette.primary}
            />
            <WaterfallRow palette={palette} label="Manager share" value={preview.managerShare} />
            <View style={styles.hr} />
            <WaterfallRow
              palette={palette}
              label={`Per unit (${totalUnits} units)`}
              value={preview.perUnit}
              strong
              highlight={palette.primary}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                title="Submit for approval"
                onPress={() => submit(false)}
                loading={declare.isPending}
                data-testid="submit-declaration-btn"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Submit as final (end project)"
                variant="danger"
                onPress={() => submit(true)}
                loading={declare.isPending}
                data-testid="submit-final-btn"
              />
            </View>
          </View>
        </View>
      )}

      {/* Declarations list */}
      <Text style={[styles.h2, { color: palette.text, marginTop: spacing.md }]}>Declarations</Text>
      {isLoading ? (
        <Text style={[styles.helper, { color: palette.textSecondary }]}>Loading…</Text>
      ) : declarations.length === 0 ? (
        <EmptyState title="No declarations yet" message="Profit declarations will appear here for review and approval." />
      ) : (
        declarations.map((d) => {
          const isPending = d.status === 'PENDING';
          const isCreatorApprover = canApprove && d.declaredBy !== user?.id;
          return (
            <View
              key={d.id}
              style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <View style={styles.rowSpread}>
                <Text style={[styles.mono, { color: palette.primary }]} selectable>
                  {d.reference}
                </Text>
                <StatusChip status={d.status} palette={palette} isFinal={d.isFinal} />
              </View>
              {d.label ? (
                <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{d.label}</Text>
              ) : null}
              <Text style={[styles.helper, { color: palette.textSecondary }]}>
                Declared {moment(d.declaredAt).fromNow()} · gross {formatNaira(d.grossMinor)}
              </Text>

              <View style={[styles.waterfall, { borderColor: palette.border, marginTop: spacing.sm }]}>
                <WaterfallRow palette={palette} label="Gross" value={d.grossMinor} />
                <WaterfallRow palette={palette} label="Costs" value={-d.costsMinor} />
                <WaterfallRow palette={palette} label="Net" value={d.netMinor} strong />
                <WaterfallRow
                  palette={palette}
                  label={`Prism fee (${(d.platformFeeBps / 100).toFixed(1)}%)`}
                  value={-d.platformFeeMinor}
                />
                <WaterfallRow palette={palette} label="Distributable" value={d.distributableMinor} />
                <WaterfallRow
                  palette={palette}
                  label={`Investor pool (${(d.profitSplitInvestorBps / 100).toFixed(0)}%)`}
                  value={d.investorPoolMinor}
                  highlight={palette.primary}
                />
                <WaterfallRow palette={palette} label="Manager share" value={d.managerShareMinor} />
                <WaterfallRow
                  palette={palette}
                  label={`Per unit (${d.totalUnitsAtDeclaration} units)`}
                  value={d.perUnitMinor}
                  strong
                  highlight={palette.primary}
                />
              </View>

              {d.status === 'REJECTED' && d.rejectionNote ? (
                <Text style={[styles.helper, { color: '#B91C1C', marginTop: 6 }]}>
                  Rejected · {d.rejectionNote}
                </Text>
              ) : null}
              {d.status === 'APPROVED' && d.approvedAt ? (
                <Text style={[styles.helper, { color: palette.textSecondary, marginTop: 6 }]}>
                  Approved {moment(d.approvedAt).fromNow()}
                </Text>
              ) : null}

              {isPending && isCreatorApprover ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Approve"
                      onPress={() => doApprove(d.id, d.reference)}
                      loading={approve.isPending}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Reject"
                      variant="secondary"
                      onPress={() => doReject(d.id, d.reference)}
                      loading={reject.isPending}
                    />
                  </View>
                </View>
              ) : isPending && canApprove && d.declaredBy === user?.id ? (
                <Text style={[styles.helper, { color: palette.textSecondary, marginTop: 6 }]}>
                  Awaiting a second approver (four-eyes principle — you can't approve your own submission).
                </Text>
              ) : isPending ? (
                <Text style={[styles.helper, { color: palette.textSecondary, marginTop: 6 }]}>
                  Awaiting CEO / Finance Admin approval.
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function WaterfallRow({
  palette,
  label,
  value,
  strong,
  highlight,
}: {
  palette: any;
  label: string;
  value: number;
  strong?: boolean;
  highlight?: string;
}) {
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

function StatusChip({
  status,
  palette,
  isFinal,
}: {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  palette: any;
  isFinal: boolean;
}) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    PENDING: { bg: palette.warningLight ?? '#FEF3C7', fg: palette.warning ?? '#B45309', label: 'Pending approval' },
    APPROVED: { bg: '#D1FAE5', fg: palette.success ?? '#047857', label: 'Approved' },
    REJECTED: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Rejected' },
  };
  const s = map[status];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {isFinal ? (
        <View style={[styles.chip, { backgroundColor: palette.primaryLight }]}>
          <Text style={{ color: palette.primary, fontSize: typography.sizes.xs, fontWeight: '700' }}>
            FINAL
          </Text>
        </View>
      ) : null}
      <View style={[styles.chip, { backgroundColor: s.bg }]}>
        <Text style={{ color: s.fg, fontSize: typography.sizes.xs, fontWeight: '700' }}>{s.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xxl },
  card: { borderWidth: 1, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, gap: 4 },
  h2: { fontSize: typography.sizes.lg, fontWeight: '700' },
  subtitle: { fontSize: typography.sizes.sm, fontWeight: '500' },
  helper: { fontSize: typography.sizes.xs },
  mono: { fontFamily: 'monospace', fontSize: typography.sizes.sm, fontWeight: '700', letterSpacing: 0.5 },
  waterfall: { borderWidth: 1, borderRadius: 8, padding: spacing.sm, gap: 6, marginTop: spacing.sm },
  wfRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hr: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
  rowSpread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
});
