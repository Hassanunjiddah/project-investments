import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Linking from 'expo-linking';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography, tabularNums } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { formatNaira } from '@/src/utils/currency';
import { formatUnits, formatUnitsLabel } from '@/src/utils/units';
import { calendarTime } from '@/src/utils/date';
import {
  useFundingRounds,
  useRequestFundingRound,
} from '@/src/hooks/fundingRounds/useFundingRounds';
import {
  uploadRoundDoc,
  getRoundDocUrl,
  type FundingRound,
} from '@/src/services/fundingRounds.services';
import { useCostLines } from '@/src/hooks/costLines/useCostLines';
import { useCreateInvite } from '@/src/hooks/invitations/useCreateInvite';
import { useFetchInvitesForProject } from '@/src/hooks/invitations/useFetchInvitesForProject';

type Props = {
  projectId: string;
  /** LM who created the project or the assigned originator. */
  canRequestRound: boolean;
  /** Staff who can send invitations into an approved raise. */
  canInvite: boolean;
  unitPriceMinor: number;
  /** Prism raise fee in bps of capital raised (same rate as the original target). */
  raiseFeeBps?: number;
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

const STATUS_META: Record<
  FundingRound['status'],
  { label: string; tone: 'warning' | 'success' | 'danger' }
> = {
  PENDING: { label: 'Awaiting CEO', tone: 'warning' },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

/**
 * Dedicated Capital raise tab. Cost lines only track CAPEX/OPEX outflows;
 * raising more capital is its own CEO-approved workflow that lives here:
 * request (units + reason + supporting doc) → CEO decision → invite
 * investors into the approved raise (existing investors get an in-app
 * request, new emails go through the code/first-signin flow).
 */
export function ProjectCapitalRaiseTab({
  projectId,
  canRequestRound,
  canInvite,
  unitPriceMinor,
  raiseFeeBps = 0,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);

  const { data: rounds = [], isLoading: roundsLoading } = useFundingRounds(projectId);
  const { data: lines = [] } = useCostLines(projectId);
  const { data: projectInvites = [] } = useFetchInvitesForProject(projectId);
  const requestRound = useRequestFundingRound(projectId);
  const createInvite = useCreateInvite(projectId);

  const [roundUnits, setRoundUnits] = useState('');
  const [roundReason, setRoundReason] = useState('');
  const [docAsset, setDocAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [openingRoundId, setOpeningRoundId] = useState<string | null>(null);
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('existing');
  const [inviteEmail, setInviteEmail] = useState('');
  const [requestingEmail, setRequestingEmail] = useState<string | null>(null);

  const pendingRound = rounds.find((r) => r.status === 'PENDING');
  const approvedRound = rounds.find((r) => r.status === 'APPROVED');

  // Existing investors on this project (confirmed money in), deduped by email.
  const existingInvestors = useMemo(() => {
    const byEmail = new Map<
      string,
      { email: string; name: string; unitsHeld: number }
    >();
    for (const inv of projectInvites) {
      if (inv.status !== 'CONFIRMED' || !inv.email) continue;
      const key = inv.email.toLowerCase();
      const prev = byEmail.get(key);
      const units = inv.unitsAllotted ?? inv.unitsPledged ?? 0;
      if (prev) {
        prev.unitsHeld += units;
      } else {
        byEmail.set(key, {
          email: inv.email,
          name: inv.investorName ?? inv.email,
          unitsHeld: units,
        });
      }
    }
    return [...byEmail.values()].sort((a, b) => b.unitsHeld - a.unitsHeld);
  }, [projectInvites]);

  // Emails already invited into the currently approved raise.
  const invitedIntoApprovedRound = useMemo(() => {
    if (!approvedRound) return new Set<string>();
    return new Set(
      projectInvites
        .filter((inv) => inv.roundId === approvedRound.id && inv.email)
        .map((inv) => inv.email!.toLowerCase()),
    );
  }, [projectInvites, approvedRound]);

  const pickDoc = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_DOC_MIME,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setDocAsset(result.assets[0]);
    }
  };

  const openRoundDoc = async (round: FundingRound) => {
    if (!round.docStoragePath) return;
    try {
      setOpeningRoundId(round.id);
      const url = await getRoundDocUrl(round.docStoragePath);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        await Linking.openURL(url);
      }
    } catch (e) {
      pushToast({
        type: 'error',
        message: e instanceof Error ? e.message : 'Could not open document',
      });
    } finally {
      setOpeningRoundId(null);
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
      let doc = null;
      if (docAsset) {
        setUploadingDoc(true);
        doc = await uploadRoundDoc(projectId, {
          uri: docAsset.uri,
          name: docAsset.name,
          mimeType: docAsset.mimeType ?? undefined,
        });
        setUploadingDoc(false);
      }
      await requestRound.mutateAsync({
        additionalUnits: units,
        reason: roundReason.trim(),
        costLineIds: lines.map((l) => l.id),
        doc,
      });
      setRoundUnits('');
      setRoundReason('');
      setDocAsset(null);
      pushToast({
        type: 'success',
        message: 'Additional capital requested — awaiting CEO approval.',
      });
    } catch (e) {
      setUploadingDoc(false);
      pushToast({ type: 'error', message: e instanceof Error ? e.message : 'Request failed' });
    }
  };

  const sendInviteTo = async (email: string) => {
    if (!approvedRound) return;
    try {
      setRequestingEmail(email.toLowerCase());
      await createInvite.mutateAsync({ email: email.trim(), roundId: approvedRound.id });
      setInviteEmail('');
      pushToast({ type: 'success', message: 'Investment request sent' });
    } catch (e) {
      pushToast({ type: 'error', message: e instanceof Error ? e.message : 'Request failed' });
    } finally {
      setRequestingEmail(null);
    }
  };

  const toneColors = (tone: 'warning' | 'success' | 'danger') => palette.semantic[tone];

  return (
    <View style={{ gap: spacing.md }}>
      {/* ── Request form ─────────────────────────────────────────── */}
      {canRequestRound ? (
        pendingRound ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: palette.semantic.warning.bg,
                borderColor: palette.semantic.warning.fg,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: palette.semantic.warning.fg }]}>
              Raise awaiting CEO approval
            </Text>
            <Text style={[styles.helper, { color: palette.semantic.warning.fg }]}>
              {formatUnits(pendingRound.additionalUnits)} additional units (
              {formatNaira(pendingRound.additionalMinor, false)}) requested{' '}
              {calendarTime(pendingRound.createdAt)}. You can send a new request once the CEO
              decides.
            </Text>
          </View>
        ) : (
          <View
            style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              Request additional capital
            </Text>
            <Text style={[styles.helper, { color: palette.textSecondary }]}>
              New units are minted at the existing unit price
              {unitPriceMinor ? ` (${formatNaira(unitPriceMinor)} each)` : ''}. Your logged cost
              lines are attached as justification. CEO approval raises the project target; when
              that additional capital is fully raised, Prism takes the same raise fee
              {raiseFeeBps > 0 ? ` (${(raiseFeeBps / 100).toFixed(1)}%)` : ''} on the extra
              amount.
            </Text>
            <TextInput
              label="Additional units"
              value={roundUnits}
              onChangeText={setRoundUnits}
              keyboardType="number-pad"
            />
            {roundUnits && Number(roundUnits) > 0 && unitPriceMinor ? (
              <Text style={[styles.helper, { color: palette.textSecondary }, tabularNums]}>
                = {formatNaira(Number(roundUnits) * unitPriceMinor, false)} additional capital
                {raiseFeeBps > 0
                  ? ` · Prism raise fee ${formatNaira(
                      Math.floor((Number(roundUnits) * unitPriceMinor * raiseFeeBps) / 10000),
                    )} when the new target is filled`
                  : ''}
              </Text>
            ) : null}
            <TextInput
              label="Reason"
              value={roundReason}
              onChangeText={setRoundReason}
              multiline
              placeholder="Why is this capital needed?"
            />
            <Pressable
              onPress={() => void pickDoc()}
              style={[styles.filePicker, { borderColor: palette.border }]}
              accessibilityRole="button"
              accessibilityLabel="Attach supporting document"
            >
              <Ionicons name="cloud-upload-outline" size={18} color={palette.primary} />
              <Text style={[styles.fileText, { color: palette.text }]} numberOfLines={1}>
                {docAsset ? docAsset.name : 'Attach supporting document (optional)'}
              </Text>
              {docAsset ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove attached document"
                  hitSlop={8}
                  onPress={() => setDocAsset(null)}
                >
                  <Ionicons name="close-circle" size={18} color={palette.muted} />
                </Pressable>
              ) : null}
            </Pressable>
            <Button
              title="Submit for CEO approval"
              loading={requestRound.isPending || uploadingDoc}
              onPress={() => void submitRound()}
            />
          </View>
        )
      ) : null}

      {/* ── Invite into approved raise ───────────────────────────── */}
      {canInvite && approvedRound ? (
        <View
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            Invite investors into the approved raise
          </Text>
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            {formatUnits(approvedRound.additionalUnits)} units at{' '}
            {formatNaira(approvedRound.unitPriceMinor)} / unit are open.
            {raiseFeeBps > 0
              ? ` When this raise is filled, Prism reserves ${(raiseFeeBps / 100).toFixed(1)}% of the extra capital as a raise fee.`
              : ''}
          </Text>

          <View style={styles.modeRow}>
            {(
              [
                { key: 'existing', label: 'Existing investor' },
                { key: 'new', label: 'New investor' },
              ] as const
            ).map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setInviteMode(m.key)}
                accessibilityRole="button"
                style={[
                  styles.modeChip,
                  {
                    borderColor: inviteMode === m.key ? palette.primary : palette.border,
                    backgroundColor:
                      inviteMode === m.key ? palette.primaryLight : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    { color: inviteMode === m.key ? palette.primary : palette.textSecondary },
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {inviteMode === 'existing' ? (
            existingInvestors.length === 0 ? (
              <Text style={[styles.helper, { color: palette.muted }]}>
                No confirmed investors on this project yet — use “New investor” instead.
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.helper, { color: palette.textSecondary }]}>
                  The request appears straight on their dashboard — no email code, no new
                  password. They pledge units and the new investment adds to their existing
                  position.
                </Text>
                {existingInvestors.map((inv) => {
                  const alreadyAsked = invitedIntoApprovedRound.has(inv.email.toLowerCase());
                  return (
                    <View
                      key={inv.email}
                      style={[styles.investorRow, { borderColor: palette.border }]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[styles.investorName, { color: palette.text }]}
                          numberOfLines={1}
                        >
                          {inv.name}
                        </Text>
                        <Text
                          style={[styles.investorMeta, { color: palette.textSecondary }]}
                          numberOfLines={1}
                        >
                          {inv.email}
                          {inv.unitsHeld > 0 ? ` · holds ${formatUnitsLabel(inv.unitsHeld)}` : ''}
                        </Text>
                      </View>
                      {alreadyAsked ? (
                        <View
                          style={[
                            styles.sentPill,
                            { backgroundColor: palette.semantic.success.bg },
                          ]}
                        >
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={palette.semantic.success.fg}
                          />
                          <Text
                            style={[styles.sentText, { color: palette.semantic.success.fg }]}
                          >
                            Requested
                          </Text>
                        </View>
                      ) : (
                        <Button
                          title="Send request"
                          size="sm"
                          variant="outline"
                          loading={requestingEmail === inv.email.toLowerCase()}
                          onPress={() => void sendInviteTo(inv.email)}
                        />
                      )}
                    </View>
                  );
                })}
              </View>
            )
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Text style={[styles.helper, { color: palette.textSecondary }]}>
                New investors get an email with a sign-in code, set their password, then pledge
                and pay as usual.
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
                loading={createInvite.isPending && requestingEmail === inviteEmail.toLowerCase()}
                onPress={() => void sendInviteTo(inviteEmail)}
              />
            </View>
          )}
        </View>
      ) : null}

      {/* ── Raise history ────────────────────────────────────────── */}
      <Text style={[styles.sectionTitle, { color: palette.text }]}>Raise history</Text>
      {roundsLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : rounds.length === 0 ? (
        <Text style={[styles.helper, { color: palette.muted }]}>
          No capital raises yet. The original target came from project creation; use the form
          above when the project needs more capital.
        </Text>
      ) : (
        rounds.map((round) => {
          const meta = STATUS_META[round.status];
          const tone = toneColors(meta.tone);
          return (
            <View
              key={round.id}
              style={[
                styles.card,
                { backgroundColor: palette.surface, borderColor: palette.border },
              ]}
            >
              <View style={styles.roundTop}>
                <Text style={[styles.roundAmount, { color: palette.text }, tabularNums]}>
                  {formatUnits(round.additionalUnits)} units ·{' '}
                  {formatNaira(round.additionalMinor, false)}
                </Text>
                <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.statusText, { color: tone.fg }]}>{meta.label}</Text>
                </View>
              </View>
              <Text style={[styles.investorMeta, { color: palette.textSecondary }]}>
                Requested {calendarTime(round.createdAt)} at{' '}
                {formatNaira(round.unitPriceMinor)} / unit
              </Text>
              <Text style={[styles.reason, { color: palette.text }]}>{round.reason}</Text>
              {round.docStoragePath ? (
                <Pressable
                  onPress={() => void openRoundDoc(round)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open document ${round.docFileName ?? ''}`}
                  style={styles.docLink}
                >
                  {openingRoundId === round.id ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Ionicons name="document-attach-outline" size={16} color={palette.primary} />
                  )}
                  <Text style={[styles.docLinkText, { color: palette.primary }]} numberOfLines={1}>
                    {round.docFileName ?? 'Supporting document'}
                  </Text>
                </Pressable>
              ) : null}
              {round.decisionNote || round.decidedAt ? (
                <Text style={[styles.investorMeta, { color: palette.muted }]}>
                  {round.status === 'APPROVED' ? 'Approved' : 'Decided'}
                  {round.decidedAt ? ` ${calendarTime(round.decidedAt)}` : ''}
                  {round.decisionNote ? ` — ${round.decisionNote}` : ''}
                </Text>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.xs,
  },
  helper: { fontSize: typography.sizes.sm, lineHeight: 20 },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    borderStyle: 'dashed',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  fileText: { flex: 1, fontSize: typography.sizes.sm },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  modeChipText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  investorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
  },
  investorName: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  investorMeta: { fontSize: typography.sizes.xs, marginTop: 1 },
  sentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sentText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  roundTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  roundAmount: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  reason: { fontSize: typography.sizes.sm, lineHeight: 20 },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  docLinkText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium },
});
