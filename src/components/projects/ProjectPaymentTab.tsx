import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Button } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/TextInput';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { formatUnits } from '@/src/utils/units';
import type { Invite, InviteStatus } from '@/src/types/invitation.types';
import type { Project } from '@/src/types/project.types';

type PendingMutation = { isPending: boolean };

type PayAccount = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

type Props = {
  invite: Invite;
  inviteStatus: InviteStatus;
  project: Project;
  remnantMode: boolean;
  unitsAvailableForPledge: number;
  effectiveMinUnits: number;
  pledgeInputMode: 'units' | 'naira';
  setPledgeInputMode: (mode: 'units' | 'naira') => void;
  commitUnits: string;
  setCommitUnits: (v: string) => void;
  commitAmount: string;
  setCommitAmount: (v: string) => void;
  investableMax: number | undefined;
  payAccount: PayAccount | undefined;
  formatUnitsLabel: (units: number) => string;
  handleCommit: () => void;
  handleUploadProof: () => void;
  requestRemnant: PendingMutation;
  pledgeUnitsMutation: PendingMutation;
  commitInvestment: PendingMutation;
  submitProof: PendingMutation;
};

export function ProjectPaymentTab({
  invite,
  inviteStatus,
  project,
  remnantMode,
  unitsAvailableForPledge,
  effectiveMinUnits,
  pledgeInputMode,
  setPledgeInputMode,
  commitUnits,
  setCommitUnits,
  commitAmount,
  setCommitAmount,
  investableMax,
  payAccount,
  formatUnitsLabel,
  handleCommit,
  handleUploadProof,
  requestRemnant,
  pledgeUnitsMutation,
  commitInvestment,
  submitProof,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View>
      {inviteStatus === 'ACCEPTED' && invite.minWaiverStatus === 'PENDING' ? (
        <View style={styles.paymentBlock}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            Awaiting Line Manager approval
          </Text>
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            You requested {formatUnitsLabel(invite.unitsPledged ?? 0)}
            {invite.amountMinor != null ? ` (${formatNaira(invite.amountMinor)})` : ''} — below the
            usual minimum of {formatUnitsLabel(effectiveMinUnits)}. Units are reserved until your
            Line Manager approves.
          </Text>
        </View>
      ) : null}
      {inviteStatus === 'ACCEPTED' && invite.minWaiverStatus !== 'PENDING' ? (
        <View style={styles.paymentBlock}>
          {project.totalUnits && project.totalUnits > 0 ? (
            <>
              {remnantMode ? (
                <View
                  style={[
                    styles.remnantBanner,
                    {
                      borderColor: palette.semantic.warning?.fg ?? palette.primary,
                      backgroundColor: palette.semantic.warning?.bg ?? palette.primaryLight,
                    },
                  ]}
                  data-testid="remnant-pledge-banner"
                >
                  <Text
                    style={[
                      styles.helper,
                      { color: palette.semantic.warning?.fg ?? palette.primary },
                    ]}
                  >
                    Only {formatUnitsLabel(unitsAvailableForPledge)} left — below your minimum of{' '}
                    {formatUnitsLabel(effectiveMinUnits)} (shortfall{' '}
                    {formatUnits(
                      Math.round((effectiveMinUnits - unitsAvailableForPledge) * 1e6) / 1e6,
                    )}
                    ). Enter what you want; we reserve up to the remnant and your Line Manager must
                    approve.
                  </Text>
                </View>
              ) : (
                <Text style={[styles.helper, { color: palette.textSecondary }]}>
                  1 unit = {formatNaira(project.unitPriceMinor ?? 0)} · Minimum{' '}
                  {formatUnitsLabel(effectiveMinUnits)}
                  {unitsAvailableForPledge > 0
                    ? ` · ${formatUnitsLabel(unitsAvailableForPledge)} available`
                    : ''}
                </Text>
              )}
              <View style={styles.pledgeModeRow}>
                {(
                  [
                    { key: 'units' as const, label: 'Units' },
                    { key: 'naira' as const, label: '₦ Naira' },
                  ] as const
                ).map((mode) => {
                  const active = pledgeInputMode === mode.key;
                  return (
                    <Pressable
                      key={mode.key}
                      onPress={() => setPledgeInputMode(mode.key)}
                      style={[
                        styles.pledgeModeChip,
                        {
                          borderColor: active ? palette.primary : palette.border,
                          backgroundColor: active ? palette.primaryLight : palette.surface,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={{
                          color: active ? palette.primary : palette.text,
                          fontSize: typography.sizes.xs,
                          fontWeight: active ? '600' : '400',
                        }}
                      >
                        {mode.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {pledgeInputMode === 'units' ? (
                <>
                  <TextInput
                    label={remnantMode ? 'Units you want' : 'How many units?'}
                    value={commitUnits}
                    onChangeText={setCommitUnits}
                    keyboardType="decimal-pad"
                    data-testid="commit-units-input"
                    placeholder={
                      remnantMode ? `e.g. ${formatUnits(unitsAvailableForPledge)}` : 'e.g. 1.5'
                    }
                  />
                  {(() => {
                    const units = parseFloat(commitUnits);
                    if (!Number.isFinite(units) || units <= 0 || !project.unitPriceMinor) {
                      return null;
                    }
                    const reserved = remnantMode
                      ? Math.min(units, unitsAvailableForPledge)
                      : units;
                    return (
                      <Text style={[styles.helper, { color: palette.primary }]}>
                        Equals {formatNaira(Math.round(reserved * project.unitPriceMinor))}
                        {remnantMode && units !== reserved
                          ? ` · reserves ${formatUnitsLabel(reserved)} of ${formatUnitsLabel(units)} requested`
                          : remnantMode
                            ? ` · shortfall vs min: ${formatUnits(Math.round((effectiveMinUnits - reserved) * 1e6) / 1e6)}`
                            : ''}
                      </Text>
                    );
                  })()}
                </>
              ) : (
                <>
                  <TextInput
                    label={remnantMode ? 'Amount you want (₦)' : 'Pledge amount (₦)'}
                    value={commitAmount}
                    onChangeText={setCommitAmount}
                    keyboardType="decimal-pad"
                    data-testid="commit-naira-input"
                    placeholder="e.g. 1800000"
                  />
                  {(() => {
                    const naira = parseFloat(commitAmount);
                    const unitPrice = project.unitPriceMinor ?? 0;
                    if (!Number.isFinite(naira) || naira <= 0 || unitPrice <= 0) {
                      return null;
                    }
                    const units = Math.round((nairaToKobo(naira) / unitPrice) * 1e6) / 1e6;
                    const reserved = remnantMode
                      ? Math.min(units, unitsAvailableForPledge)
                      : units;
                    return (
                      <Text style={[styles.helper, { color: palette.primary }]}>
                        Equals {formatUnitsLabel(reserved)}
                        {remnantMode && units !== reserved
                          ? ` · of ${formatUnitsLabel(units)} requested`
                          : remnantMode
                            ? ` · shortfall vs min: ${formatUnits(Math.round((effectiveMinUnits - reserved) * 1e6) / 1e6)}`
                            : ''}
                      </Text>
                    );
                  })()}
                </>
              )}
              <Button
                title={
                  remnantMode
                    ? 'Request remnant pledge'
                    : pledgeInputMode === 'naira'
                      ? 'Pledge amount'
                      : 'Pledge units'
                }
                onPress={handleCommit}
                loading={requestRemnant.isPending || pledgeUnitsMutation.isPending}
                data-testid="pledge-units-btn"
              />
            </>
          ) : (
            <>
              <TextInput
                label="Commit amount (₦)"
                value={commitAmount}
                placeholder={investableMax != null ? String(investableMax / 100) : undefined}
                onChangeText={setCommitAmount}
                keyboardType="decimal-pad"
              />
              {investableMax != null ? (
                <Text style={[styles.helper, { color: palette.textSecondary }]}>
                  Maximum allowed: {formatNaira(investableMax)}
                </Text>
              ) : null}
              <Button
                title="Commit investment"
                onPress={handleCommit}
                loading={commitInvestment.isPending}
              />
            </>
          )}
        </View>
      ) : null}

      {invite.paymentReference &&
      (inviteStatus === 'COMMITTED' || inviteStatus === 'PROOF_SUBMITTED') ? (
        <View
          style={[
            styles.paymentBlock,
            {
              backgroundColor: palette.primaryLight,
              padding: spacing.md,
              borderRadius: 12,
              gap: 4,
            },
          ]}
        >
          <Text style={[styles.helper, { color: palette.primary }]}>
            Include this reference in your transfer narration
          </Text>
          <Text
            style={{
              color: palette.primary,
              fontFamily: 'monospace',
              fontSize: typography.sizes.lg,
              fontWeight: '700',
              letterSpacing: 1,
            }}
            data-testid="payment-reference"
            selectable
          >
            {invite.paymentReference}
          </Text>
          {invite.unitsPledged ? (
            <Text style={[styles.helper, { color: palette.primary }]}>
              Pledged {formatUnitsLabel(invite.unitsPledged)} ·{' '}
              {invite.amountMinor ? formatNaira(invite.amountMinor) : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      {payAccount &&
      (inviteStatus === 'COMMITTED' || inviteStatus === 'PROOF_SUBMITTED') ? (
        <View style={styles.paymentBlock}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Escrow bank details</Text>
          <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
            Bank: {payAccount.bankName}
          </Text>
          <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
            Account name: {payAccount.accountName}
          </Text>
          <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
            Account number: {payAccount.accountNumber}
          </Text>
        </View>
      ) : null}

      {inviteStatus === 'COMMITTED' ? (
        <View style={styles.paymentBlock}>
          <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
            Transfer funds to the account above, then attach your proof of payment.
          </Text>
          <Button
            title="Attach proof (PDF or image)"
            onPress={handleUploadProof}
            loading={submitProof.isPending}
          />
        </View>
      ) : null}

      {inviteStatus === 'PROOF_SUBMITTED' ? (
        <View style={styles.paymentBlock}>
          <Text style={[styles.bodyText, { color: palette.primary }]}>
            {invite.proofFileName
              ? `Proof submitted: ${invite.proofFileName}`
              : 'Payment proof submitted.'}
          </Text>
          <Text style={[styles.bodyText, { color: palette.textSecondary }]}>
            Awaiting manager confirmation.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  bodyText: { fontSize: typography.sizes.sm, lineHeight: 20 },
  helper: { fontSize: typography.sizes.xs, marginBottom: spacing.sm },
  paymentBlock: { marginBottom: spacing.lg, gap: spacing.sm },
  remnantBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  pledgeModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  pledgeModeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
});
