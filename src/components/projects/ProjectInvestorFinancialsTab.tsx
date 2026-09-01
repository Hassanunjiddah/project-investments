import { View, Text, StyleSheet } from 'react-native';
import type { QueryClient } from '@tanstack/react-query';
import { Button } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/TextInput';
import { InvestorFinancialsCard } from '@/src/components/projects/InvestorFinancialsCard';
import { InvestorWithdrawalHistory } from '@/src/components/projects/InvestorWithdrawalHistory';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira, nairaToKobo, parseNairaInput } from '@/src/utils/currency';
import {
  investorWithdrawableMinor,
  requestProfitWithdrawal,
} from '@/src/services/projectOps.services';
import type { Invite } from '@/src/types/invitation.types';
import type { Project } from '@/src/types/project.types';

type ProfitMeta = {
  realisedProfitMinor: number;
  investorRealisedMinor: number;
  progressStartedAt?: string;
};

type Props = {
  project: Project;
  invite: Invite;
  profitMeta: ProfitMeta | undefined;
  withdrawable: number | null;
  withdrawableLoading: boolean;
  withdrawAmount: string;
  setWithdrawAmount: (v: string) => void;
  setWithdrawable: (v: number | null) => void;
  setWithdrawableLoading: (v: boolean) => void;
  qc: QueryClient;
};

export function ProjectInvestorFinancialsTab({
  project,
  invite,
  profitMeta,
  withdrawable,
  withdrawableLoading,
  withdrawAmount,
  setWithdrawAmount,
  setWithdrawable,
  setWithdrawableLoading,
  qc,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  return (
    <View style={{ gap: spacing.md }}>
      <InvestorFinancialsCard
        projectId={project.id}
        projectName={project.name}
        projectStage={project.stage}
        inviteId={invite.id}
        capitalMinor={invite.amountMinor ?? 0}
        projectedProfitMinor={invite.projectedProfitMinor ?? 0}
        projectRealisedProfitMinor={profitMeta?.realisedProfitMinor ?? 0}
        profitSplitInvestorBps={project.profitSplitInvestorBps}
        projectRaisedMinor={project.raisedMinor}
        projectTargetMinor={project.targetMinor}
        unitsHeld={invite.unitsAllotted ?? invite.unitsPledged ?? 0}
        totalUnits={project.totalUnits ?? 0}
        unitPriceMinor={project.unitPriceMinor ?? 0}
      />
      <View
        style={[
          styles.paymentBlock,
          {
            borderColor: palette.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: spacing.md,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Withdraw realised profit
        </Text>
        <Text style={[styles.helper, { color: palette.textSecondary }]}>
          Available:{' '}
          {withdrawableLoading || withdrawable == null ? '…' : formatNaira(withdrawable, false)}.
          This is realised profit still unpaid (not the full “Realised so far” figure). Prism
          approves and pays out on request.
        </Text>
        <Button
          title="Refresh available"
          size="sm"
          variant="outline"
          loading={withdrawableLoading}
          onPress={async () => {
            if (!invite?.id) return;
            setWithdrawableLoading(true);
            try {
              const amt = await investorWithdrawableMinor(invite.id);
              setWithdrawable(amt);
            } catch (err) {
              pushToast({
                type: 'error',
                message: err instanceof Error ? err.message : 'Could not load balance',
              });
            } finally {
              setWithdrawableLoading(false);
            }
          }}
        />
        <TextInput
          label="Amount (₦)"
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
          keyboardType="decimal-pad"
          placeholder={
            withdrawable != null && withdrawable > 0
              ? `Max ${formatNaira(withdrawable, false)}`
              : undefined
          }
        />
        <Button
          title="Request withdrawal"
          onPress={async () => {
            try {
              const minor = nairaToKobo(parseNairaInput(withdrawAmount));
              if (minor <= 0) {
                pushToast({
                  type: 'error',
                  message: 'Enter an amount greater than zero.',
                });
                return;
              }
              if (withdrawable != null && minor > withdrawable) {
                pushToast({
                  type: 'error',
                  message: `Maximum available is ${formatNaira(withdrawable, false)}.`,
                });
                return;
              }
              await requestProfitWithdrawal(invite.id, minor);
              setWithdrawAmount('');
              const amt = await investorWithdrawableMinor(invite.id);
              setWithdrawable(amt);
              void qc.invalidateQueries({
                queryKey: ['withdrawals', 'invite', invite.id],
              });
              void qc.invalidateQueries({
                queryKey: ['withdrawals', project.id],
              });
              pushToast({
                type: 'success',
                message: 'Withdrawal requested — awaiting Prism.',
              });
            } catch (err) {
              const raw = err instanceof Error ? err.message : 'Withdrawal failed';
              const koboMatch = raw.match(
                /exceeds available realised profit \((\d+)\s*kobo\)/i,
              );
              const message = koboMatch
                ? `Maximum available is ${formatNaira(Number(koboMatch[1]), false)}.`
                : raw;
              pushToast({ type: 'error', message });
            }
          }}
        />
      </View>
      <InvestorWithdrawalHistory inviteId={invite.id} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  helper: { fontSize: typography.sizes.xs, marginBottom: spacing.sm },
  paymentBlock: { marginBottom: spacing.lg, gap: spacing.sm },
});
