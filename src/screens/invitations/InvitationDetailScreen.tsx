import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useGetInvitationDetail } from '@/src/hooks/invitations/useGetInvitationDetail';
import { useAcceptInvite } from '@/src/hooks/invitations/useAcceptInvite';
import { useCommitInvestment } from '@/src/hooks/invitations/useCommitInvestment';
import { useSubmitPaymentProof } from '@/src/hooks/invitations/useSubmitPaymentProof';
import { ScreenLayout } from '@/src/components/ui/ScreenLayout';
import { Spinner } from '@/src/components/ui/Spinner';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { Button } from '@/src/components/ui/Button';
import { TextInput } from '@/src/components/ui/TextInput';
import { useUiStore } from '@/src/store/useUiStore';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { INVITE_STATUS_LABELS } from '@/src/types/invitation.types';
import { DOC_KIND_LABELS } from '@/src/types/document.types';
import type { DocKind } from '@/src/types/document.types';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

const PROOF_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export default function InvitationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const [commitAmount, setCommitAmount] = useState('');

  const { data, isLoading, isError, error, refetch, isRefetching } = useGetInvitationDetail(
    id ?? '',
  );
  const acceptInvite = useAcceptInvite();
  const commitInvestment = useCommitInvestment();
  const submitProof = useSubmitPaymentProof();

  if (isLoading) return <Spinner />;

  if (isError) {
    return (
      <EmptyState
        title="Could not load invitation"
        message={error?.message}
        actionLabel="Retry"
        onAction={() => refetch()}
      />
    );
  }

  if (!data) return <EmptyState title="Invitation not found" />;

  const { invite, project, documents, payAccount, mudarabahTerms } = data;
  const status = invite.status;

  const handleAccept = async () => {
    try {
      await acceptInvite.mutateAsync(invite.id);
      pushToast({ type: 'success', message: 'Terms accepted.' });
      refetch();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Accept failed',
      });
    }
  };

  const handleCommit = async () => {
    const naira = parseFloat(commitAmount) || (invite.amountKobo != null ? invite.amountKobo / 100 : 0);
    try {
      await commitInvestment.mutateAsync({
        inviteId: invite.id,
        amountKobo: nairaToKobo(naira),
      });
      pushToast({ type: 'success', message: 'Investment committed.' });
      refetch();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Commit failed',
      });
    }
  };

  const handleUploadProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: PROOF_MIME,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    try {
      await submitProof.mutateAsync({
        inviteId: invite.id,
        uri: asset.uri,
        fileName: asset.name ?? 'proof',
        mimeType: asset.mimeType ?? 'application/pdf',
      });
      pushToast({ type: 'success', message: 'Payment proof submitted.' });
      refetch();
    } catch (err) {
      pushToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    }
  };

  return (
    <ScreenLayout>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        <Text style={[styles.heading, { color: palette.text }]}>{project.name}</Text>
        <Badge label={INVITE_STATUS_LABELS[status]} variant="accent" />

        <Card style={styles.card}>
          <DetailRow label="Sector" value={project.sector} />
          <DetailRow label="Target" value={formatNaira(project.targetKobo)} />
          {invite.amountKobo != null ? (
            <DetailRow label="Amount" value={formatNaira(invite.amountKobo)} />
          ) : null}
          {invite.projectedProfitKobo != null ? (
            <DetailRow
              label="Projected profit"
              value={formatNaira(invite.projectedProfitKobo)}
              highlight
            />
          ) : null}
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Summary</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{project.summary}</Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Risks</Text>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{project.risks}</Text>
        </Card>

        {status === 'INVITED' ? (
          <Card style={styles.card}>
            <Text style={[styles.locked, { color: palette.textSecondary }]}>
              Full project details and documents unlock after you accept the Mudarabah terms.
            </Text>
            <Text style={[styles.terms, { color: palette.textSecondary }]}>
              Investor share: {mudarabahTerms.profitSplitInvestorBps / 100}% · Exit notice:{' '}
              {mudarabahTerms.exitNoticeDays} days · Early exit penalty:{' '}
              {mudarabahTerms.earlyExitPenaltyBps / 100}%
            </Text>
            <Button title="Accept terms" onPress={handleAccept} loading={acceptInvite.isPending} />
          </Card>
        ) : null}

        {project.fullDetails ? (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Full details</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              {project.fullDetails}
            </Text>
            {project.timeline ? (
              <>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Timeline</Text>
                <Text style={[styles.body, { color: palette.textSecondary }]}>
                  {project.timeline}
                </Text>
              </>
            ) : null}
          </Card>
        ) : null}

        {documents && documents.length > 0 ? (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Documents</Text>
            {documents.map((doc) => (
              <View key={doc.id} style={styles.docRow}>
                <View style={styles.docInfo}>
                  <Text style={[styles.docTitle, { color: palette.text }]}>{doc.title}</Text>
                  <Text style={[styles.docMeta, { color: palette.textSecondary }]}>
                    {doc.fileName}
                  </Text>
                </View>
                <Badge label={DOC_KIND_LABELS[doc.kind as DocKind]} variant="accent" />
              </View>
            ))}
          </Card>
        ) : null}

        {status === 'ACCEPTED' ? (
          <Card style={styles.card}>
            <TextInput
              label="Commit amount (₦)"
              value={commitAmount || (invite.amountKobo != null ? String(invite.amountKobo / 100) : '')}
              onChangeText={setCommitAmount}
              keyboardType="decimal-pad"
            />
            <Button
              title="Commit investment"
              onPress={handleCommit}
              loading={commitInvestment.isPending}
            />
          </Card>
        ) : null}

        {payAccount ? (
          <Card style={styles.card}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Escrow bank details</Text>
            <DetailRow label="Bank" value={payAccount.bankName} />
            <DetailRow label="Account name" value={payAccount.accountName} />
            <DetailRow label="Account number" value={payAccount.accountNumber} />
          </Card>
        ) : null}

        {status === 'COMMITTED' ? (
          <Card style={styles.card}>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              Transfer funds to the account above, then attach your proof of payment.
            </Text>
            <Button
              title="Attach proof (PDF or image)"
              onPress={handleUploadProof}
              loading={submitProof.isPending}
            />
          </Card>
        ) : null}

        {status === 'PROOF_SUBMITTED' || status === 'CONFIRMED' ? (
          <Card style={styles.card}>
            <Text style={[styles.body, { color: palette.primary }]}>
              {invite.proofFileName
                ? `Proof submitted: ${invite.proofFileName}`
                : 'Payment proof submitted.'}
            </Text>
            {status === 'PROOF_SUBMITTED' ? (
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                Waiting for line manager to confirm payment.
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: highlight ? palette.primary : palette.text }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  locked: {
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  terms: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  rowLabel: {
    fontSize: typography.sizes.sm,
  },
  rowValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  docMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
});
