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
  useForwardProfitProposal,
  useProjectDeclarations,
  useProposeProfitToLm,
  useRejectDeclaration,
} from '@/src/hooks/profits/useProfitDeclarations';
import { OwnerWithdrawalPanel } from '@/src/components/projects/OwnerWithdrawalPanel';
import { WaterfallRow } from '@/src/components/projects/WaterfallRow';
import { relativeTime } from '@/src/utils/date';
import { useSession } from '@/src/hooks/auth/useSession';

type Props = {
  projectId: string;
  projectStage: 'INITIATION' | 'ACCEPTANCE' | 'PROGRESS' | 'END';
  /** Prism LM — declare straight to CEO / investor path */
  canDeclare: boolean;
  /** Project owner — propose to LM only */
  canProposeToLm?: boolean;
  /** Prism LM — forward owner PROPOSED → PENDING */
  canForwardProposal?: boolean;
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
  canProposeToLm = false,
  canForwardProposal = false,
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
  const propose = useProposeProfitToLm(projectId);
  const forward = useForwardProfitProposal(projectId);
  const approve = useApproveDeclaration();
  const reject = useRejectDeclaration();

  const canSubmitForm = (canDeclare || canProposeToLm) && projectStage === 'PROGRESS';

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
        const payload = {
          projectId,
          grossMinor: grossKobo,
          costsMinor: costsKobo,
          label: label || undefined,
          isFinal,
        };
        if (canProposeToLm && !canDeclare) {
          await propose.mutateAsync(payload);
          pushToast({
            type: 'success',
            message: 'Proposed to your Prism Line Manager. They will declare to investors.',
          });
        } else {
          await declare.mutateAsync(payload);
          pushToast({
            type: 'success',
            message: isFinal
              ? 'Final declaration submitted for approval.'
              : 'Declaration submitted for approval.',
          });
        }
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
    if (isFinal && canDeclare) {
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
    const run = async (note: string) => {
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
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const note = window.prompt(`Reason for rejecting ${ref}?`);
      if (note === null) return;
      void run(note);
      return;
    }

    if (Platform.OS === 'ios') {
      Alert.prompt(
        `Reject ${ref}`,
        'Optional note for the Line Manager',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: (note?: string) => {
              void run(note ?? '');
            },
          },
        ],
        'plain-text',
      );
      return;
    }

    Alert.alert(`Reject ${ref}`, 'Reject this declaration?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => {
          void run('');
        },
      },
    ]);
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

      {/* Waterfall preview + form (owner proposes to LM, or LM declares) */}
      {canSubmitForm && (
        <View
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.h2, { color: palette.text }]}>
            {canProposeToLm && !canDeclare ? 'Propose profit to Prism' : 'Declare profit'}
          </Text>
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            {canProposeToLm && !canDeclare
              ? 'You propose figures to your Line Manager. Prism declares to investors after review and CEO approval.'
              : 'Enter gross profit and costs. The waterfall is calculated live below and locked when you submit for approval.'}
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
                title={
                  canProposeToLm && !canDeclare
                    ? 'Propose to Line Manager'
                    : 'Submit for approval'
                }
                onPress={() => submit(false)}
                loading={declare.isPending || propose.isPending}
                data-testid="submit-declaration-btn"
              />
            </View>
            {canDeclare ? (
              <View style={{ flex: 1 }}>
                <Button
                  title="Submit as final (end project)"
                  variant="danger"
                  onPress={() => submit(true)}
                  loading={declare.isPending}
                  data-testid="submit-final-btn"
                />
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Declarations list */}
      <Text style={[styles.h2, { color: palette.text, marginTop: spacing.md }]}>Declarations</Text>
      {isLoading ? (
        <Text style={[styles.helper, { color: palette.textSecondary }]}>Loading…</Text>
      ) : declarations.length === 0 ? (
        <EmptyState
          title="No declarations yet"
          message={
            canProposeToLm && !canDeclare
              ? 'Propose profit figures to your Prism Line Manager. They declare to investors after review.'
              : canDeclare
                ? 'Submit a declaration for CEO approval, or forward an owner proposal.'
                : 'Profit declarations will appear here once Prism submits them for approval.'
          }
        />
      ) : (
        declarations.map((d) => {
          const isPending = d.status === 'PENDING';
          const isProposed = d.status === 'PROPOSED';
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
                {isProposed ? 'Proposed' : 'Declared'} {relativeTime(d.declaredAt)} · gross{' '}
                {formatNaira(d.grossMinor)}
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
                  Approved {relativeTime(d.approvedAt)}
                </Text>
              ) : null}

              {isProposed && canForwardProposal ? (
                <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                  <Text style={[styles.helper, { color: palette.textSecondary }]}>
                    Owner proposed to you. Declare to investors by submitting for CEO approval.
                  </Text>
                  <Button
                    title="Declare to investors"
                    onPress={async () => {
                      try {
                        await forward.mutateAsync(d.id);
                        pushToast({
                          type: 'success',
                          message: 'Submitted for CEO approval — investors notified on approval.',
                        });
                        onChanged?.();
                      } catch (err) {
                        pushToast({
                          type: 'error',
                          message:
                            err instanceof Error ? err.message : 'Could not forward proposal.',
                        });
                      }
                    }}
                    loading={forward.isPending}
                    data-testid="forward-proposal-btn"
                  />
                </View>
              ) : isProposed ? (
                <Text style={[styles.helper, { color: palette.textSecondary, marginTop: 6 }]}>
                  With Prism Line Manager — not yet declared to investors.
                </Text>
              ) : isPending && isCreatorApprover ? (
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

      {canProposeToLm ? <OwnerWithdrawalPanel projectId={projectId} /> : null}
    </ScrollView>
  );
}

function StatusChip({
  status,
  palette,
  isFinal,
}: {
  status: 'PROPOSED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  palette: any;
  isFinal: boolean;
}) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    PROPOSED: { bg: '#E0E7FF', fg: '#3730A3', label: 'Proposed to LM' },
    PENDING: { bg: palette.warningLight ?? '#FEF3C7', fg: palette.warning ?? '#B45309', label: 'Pending approval' },
    APPROVED: { bg: '#D1FAE5', fg: palette.success ?? '#047857', label: 'Approved' },
    REJECTED: { bg: '#FEE2E2', fg: '#B91C1C', label: 'Rejected' },
  };
  const s = map[status] ?? map.PENDING;
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
  hr: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 4 },
  rowSpread: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 999 },
});
