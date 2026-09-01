import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormProvider, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { FormInput } from '@/src/components/form/FormInput';
import { FormSubmitButton } from '@/src/components/form/FormSubmitButton';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira } from '@/src/utils/currency';
import { formatUnitsLabel } from '@/src/utils/units';
import type { InviteInvestorFormValues } from '@/src/schemas/project.schema';
import type { Role } from '@/src/constants/roles';
import {
  INVITE_STATUS_LABELS,
  INVESTED_INVITE_STATUSES,
  type Invite,
} from '@/src/types/invitation.types';

type RemnantMutation = {
  isPending: boolean;
  mutateAsync: (inviteId: string) => Promise<unknown>;
};

type Props = {
  invites: Invite[];
  displayInvites: Invite[];
  invitesLoading: boolean;
  canInvite: boolean;
  showInviteForm: boolean;
  setShowInviteForm: (v: boolean | ((prev: boolean) => boolean)) => void;
  inviteMethods: UseFormReturn<InviteInvestorFormValues>;
  handleInvite: () => void;
  inviteParam: string | string[] | undefined;
  role: Role | null;
  canManage: boolean;
  handleCopyInviteLink: (row: Invite) => void;
  handleMessageInvestor: (investorId: string) => void;
  approveRemnant: RemnantMutation;
  rejectRemnant: RemnantMutation;
  handleConfirmPayment: (inviteId: string) => void;
  handleManagerDecline: (inviteId: string) => void;
  confirmPayment: { isPending: boolean };
  refetchInvites: () => void;
};

export function ProjectInvestorsTab({
  invites,
  displayInvites,
  invitesLoading,
  canInvite,
  showInviteForm,
  setShowInviteForm,
  inviteMethods,
  handleInvite,
  inviteParam,
  canManage,
  handleCopyInviteLink,
  handleMessageInvestor,
  approveRemnant,
  rejectRemnant,
  handleConfirmPayment,
  handleManagerDecline,
  confirmPayment,
  refetchInvites,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  return (
    <View>
      <View style={styles.investorsHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text, marginBottom: 0 }]}>
          Investors
        </Text>
        {canInvite ? (
          <Button
            title={showInviteForm ? 'Cancel' : 'Invite Investor'}
            size="sm"
            variant={showInviteForm ? 'outline' : 'primary'}
            onPress={() => setShowInviteForm((v) => !v)}
          />
        ) : null}
      </View>

      {showInviteForm && canInvite ? (
        <View
          style={[
            styles.inviteForm,
            { borderColor: palette.border, backgroundColor: palette.surface },
          ]}
        >
          <FormProvider {...inviteMethods}>
            <FormInput
              name="email"
              label="Investor email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="investor@example.com"
            />
            <FormInput
              name="minUnits"
              label="Min units — optional"
              keyboardType="numeric"
              placeholder="Leave blank to use project minimum"
            />
            <FormSubmitButton title="Send invite" onPress={handleInvite} />
          </FormProvider>
        </View>
      ) : null}

      {invitesLoading ? (
        <ActivityIndicator color={palette.primary} style={{ marginTop: spacing.md }} />
      ) : invites.length === 0 ? (
        <Text style={[styles.bodyText, { color: palette.muted, marginTop: spacing.sm }]}>
          No investors invited yet.
        </Text>
      ) : (
        displayInvites.map((row) => {
          const invested = INVESTED_INVITE_STATUSES.includes(row.status);
          const isDeepLinked = !!inviteParam && row.id === String(inviteParam);
          return (
            <View
              key={row.id}
              style={[
                styles.inviteRow,
                {
                  borderColor: isDeepLinked ? palette.primary : palette.border,
                  backgroundColor: isDeepLinked ? palette.brand[50] : palette.surface,
                  borderWidth: isDeepLinked ? 2 : 1,
                },
              ]}
            >
              <View style={styles.inviteRowTop}>
                <Text style={[styles.inviteName, { color: palette.text }]}>
                  {row.investorName || row.email || row.investorId}
                </Text>
                <Badge label={INVITE_STATUS_LABELS[row.status]} variant="accent" />
              </View>
              {row.email && row.investorName ? (
                <Text style={[styles.inviteMeta, { color: palette.muted }]}>{row.email}</Text>
              ) : null}
              {invested && row.amountMinor != null ? (
                <Text style={[styles.inviteAmount, { color: palette.text }]}>
                  {row.unitsPledged
                    ? `${formatUnitsLabel(row.unitsPledged)} · ${formatNaira(row.amountMinor)}`
                    : `Invested: ${formatNaira(row.amountMinor)}`}
                </Text>
              ) : row.minWaiverStatus === 'PENDING' && row.unitsPledged != null ? (
                <Text style={[styles.inviteAmount, { color: palette.primary }]}>
                  Remnant request: {formatUnitsLabel(row.unitsPledged)}
                  {row.amountMinor != null ? ` · ${formatNaira(row.amountMinor)}` : ''}
                  {row.minUnits != null ? ` (min was ${formatUnitsLabel(row.minUnits)})` : ''}
                </Text>
              ) : row.minUnits != null ? (
                <Text style={[styles.inviteMeta, { color: palette.muted }]}>
                  Min: {row.minUnits} unit{row.minUnits === 1 ? '' : 's'}
                </Text>
              ) : row.maxInvestmentAmountMinor != null ? (
                <Text style={[styles.inviteMeta, { color: palette.muted }]}>
                  Max: {formatNaira(row.maxInvestmentAmountMinor)}
                </Text>
              ) : null}
              {row.minWaiverStatus === 'PENDING' ? (
                <Badge label="Remnant pending" variant="accent" />
              ) : null}
              {row.paymentReference && invested ? (
                <Text
                  style={[
                    styles.inviteMeta,
                    {
                      color: palette.primary,
                      fontFamily: 'monospace',
                      marginTop: 2,
                    },
                  ]}
                  selectable
                >
                  ref · {row.paymentReference}
                </Text>
              ) : null}
              {row.firstSigninCode && !row.firstSigninCodeRedeemedAt && canManage ? (
                <Pressable
                  onPress={() => handleCopyInviteLink(row)}
                  style={[
                    styles.copyLinkBtn,
                    { borderColor: palette.border, backgroundColor: palette.surfaceMuted },
                  ]}
                  data-testid={`copy-invite-link-${row.id}`}
                >
                  <Ionicons name="link-outline" size={14} color={palette.primary} />
                  <Text
                    style={{
                      color: palette.primary,
                      fontSize: typography.sizes.xs,
                      fontWeight: '600',
                    }}
                  >
                    Copy invite link
                  </Text>
                </Pressable>
              ) : null}
              {invested && row.investorId ? (
                <Pressable
                  onPress={() => handleMessageInvestor(row.investorId!)}
                  style={[
                    styles.copyLinkBtn,
                    {
                      borderColor: palette.border,
                      backgroundColor: palette.surfaceMuted,
                      marginTop: 6,
                    },
                  ]}
                  data-testid={`message-investor-${row.id}`}
                  testID={`message-investor-${row.id}`}
                  accessibilityRole="button"
                  accessibilityLabel="Message this investor"
                >
                  <Ionicons name="chatbubble-outline" size={14} color={palette.primary} />
                  <Text
                    style={{
                      color: palette.primary,
                      fontSize: typography.sizes.xs,
                      fontWeight: '600',
                    }}
                  >
                    Message
                  </Text>
                </Pressable>
              ) : null}
              {row.minWaiverStatus === 'PENDING' && canManage ? (
                <View style={styles.inviteActions}>
                  <Button
                    title="Decline remnant"
                    size="sm"
                    variant="outlineDanger"
                    onPress={async () => {
                      try {
                        await rejectRemnant.mutateAsync(row.id);
                        pushToast({ type: 'info', message: 'Remnant pledge declined.' });
                        refetchInvites();
                      } catch (err) {
                        pushToast({
                          type: 'error',
                          message: err instanceof Error ? err.message : 'Decline failed',
                        });
                      }
                    }}
                    loading={rejectRemnant.isPending}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Approve remnant"
                    size="sm"
                    onPress={async () => {
                      try {
                        await approveRemnant.mutateAsync(row.id);
                        pushToast({
                          type: 'success',
                          message: 'Remnant pledge approved — investor can pay.',
                        });
                        refetchInvites();
                      } catch (err) {
                        pushToast({
                          type: 'error',
                          message: err instanceof Error ? err.message : 'Approve failed',
                        });
                      }
                    }}
                    loading={approveRemnant.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
              {row.status === 'PROOF_SUBMITTED' && canManage ? (
                <View style={styles.inviteActions}>
                  <Button
                    title="Decline"
                    size="sm"
                    variant="outlineDanger"
                    onPress={() => handleManagerDecline(row.id)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Confirm payment"
                    size="sm"
                    onPress={() => handleConfirmPayment(row.id)}
                    loading={confirmPayment.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
            </View>
          );
        })
      )}
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
  investorsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  inviteForm: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inviteRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  inviteRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  inviteName: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  inviteMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
  inviteAmount: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginTop: 6,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
});
