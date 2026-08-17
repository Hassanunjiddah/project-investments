import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useUiStore } from '@/src/store/useUiStore';
import { useAuthStore } from '@/src/store/useAuthStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { Badge } from '@/src/components/ui/Badge';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import {
  decideFundDrawdown,
  fetchFundDrawdowns,
  markFundDrawdownPaid,
  requestFundDrawdown,
} from '@/src/services/projectOps.services';
import {
  getDocumentSignedUrl,
  uploadProjectDocument,
} from '@/src/services/documents.services';

type Props = {
  projectId: string;
  canRequest: boolean;
  canDecide: boolean;
};

const ALLOWED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function ProjectDrawdownsTab({ projectId, canRequest, canDecide }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();

  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [category, setCategory] = useState<'FUND_USE' | 'RISK_MITIGATION' | 'OTHER'>('FUND_USE');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['fund-drawdowns', projectId],
    queryFn: () => fetchFundDrawdowns(projectId),
    enabled: !!projectId,
  });

  const accountOk =
    bankName.trim().length >= 2 &&
    accountName.trim().length >= 2 &&
    accountNumber.replace(/\s/g, '').length >= 8;

  const purposeOk = purpose.trim().length >= 20;
  const amountOk = parseFloat(amount) > 0;

  const pickSupportDoc = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setFile(result.assets[0]);
    }
  };

  const requestMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      if (!file) throw new Error('Attach a supporting invoice, quote, or receipt');

      const amountMinor = nairaToKobo(parseFloat(amount) || 0);
      const doc = await uploadProjectDocument({
        projectId,
        userId: user.id,
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType ?? 'application/octet-stream',
        sizeBytes: file.size ?? 0,
        kind: 'FUND_USE',
        title: `Remittance evidence · ${file.name.replace(/\.[^/.]+$/, '')}`,
        note: purpose.trim().slice(0, 200),
        amountMinor,
      });

      return requestFundDrawdown({
        projectId,
        amountMinor,
        purpose: purpose.trim(),
        category,
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: accountNumber.replace(/\s/g, ''),
        supportDocId: doc.id,
      });
    },
    onSuccess: () => {
      setAmount('');
      setPurpose('');
      setBankName('');
      setAccountName('');
      setAccountNumber('');
      setFile(null);
      qc.invalidateQueries({ queryKey: ['fund-drawdowns', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['documents', projectId] });
      pushToast({
        type: 'success',
        message: 'Remittance requested — Prism will review your evidence and payout account.',
      });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  const decideMut = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      decideFundDrawdown(id, approve),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-drawdowns', projectId] });
      pushToast({ type: 'success', message: 'Drawdown updated.' });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  const paidMut = useMutation({
    mutationFn: (id: string) => markFundDrawdownPaid(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fund-drawdowns', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      pushToast({
        type: 'success',
        message: 'Marked paid — current capital reduced; capital raised unchanged. Ledger audited.',
      });
    },
    onError: (e: Error) => pushToast({ type: 'error', message: e.message }),
  });

  const openSupportDoc = async (row: (typeof rows)[0]) => {
    if (!row.supportDocStoragePath) {
      pushToast({ type: 'error', message: 'No supporting document on this request.' });
      return;
    }
    setOpeningDocId(row.id);
    try {
      const url = await getDocumentSignedUrl(row.supportDocStoragePath);
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
      setOpeningDocId(null);
    }
  };

  return (
    <View style={styles.wrap} data-testid="project-drawdowns-tab">
      <Text style={[styles.title, { color: palette.text }]}>
        {canRequest ? 'Fund remittance requests' : 'Project owner remittances'}
      </Text>
      <Text style={[styles.help, { color: palette.textSecondary }]}>
        {canRequest
          ? 'Submit a formal remittance request with payout account details and a supporting invoice, quote, or receipt. Your Prism Line Manager reviews the evidence, then marks paid when funds are transferred.'
          : 'Review each remittance against the attached evidence. Approve or reject, then mark paid after you send funds to the listed account. Paid amounts reduce current capital and post to the project ledger.'}
      </Text>

      {canRequest ? (
        <View style={[styles.form, { borderColor: palette.border, backgroundColor: palette.surface }]}>
          <Text style={[styles.formTitle, { color: palette.text }]}>New remittance request</Text>
          <Text style={[styles.formHint, { color: palette.textSecondary }]}>
            All fields are required. Purpose must clearly describe how the funds will be used.
          </Text>

          <TextInput
            label="Amount (₦)"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            data-testid="drawdown-amount"
          />
          <TextInput
            label="Purpose / use of funds"
            value={purpose}
            onChangeText={setPurpose}
            data-testid="drawdown-purpose"
            placeholder="Describe the remittance use in detail (min. 20 characters)"
            multiline
          />
          {!purposeOk && purpose.length > 0 ? (
            <Text style={[styles.fieldHint, { color: palette.semantic.danger.fg }]}>
              Add more detail — {20 - purpose.trim().length} characters remaining.
            </Text>
          ) : null}

          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Category</Text>
          <View style={styles.catRow}>
            {(
              [
                { key: 'FUND_USE' as const, label: 'Fund use' },
                { key: 'RISK_MITIGATION' as const, label: 'Risk mitigation' },
                { key: 'OTHER' as const, label: 'Other' },
              ] as const
            ).map((c) => {
              const active = category === c.key;
              return (
                <Button
                  key={c.key}
                  title={c.label}
                  size="sm"
                  variant={active ? 'primary' : 'outline'}
                  onPress={() => setCategory(c.key)}
                />
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
            Payout account
          </Text>
          <TextInput
            label="Bank name"
            value={bankName}
            onChangeText={setBankName}
            data-testid="drawdown-bank-name"
            placeholder="e.g. Access Bank"
          />
          <TextInput
            label="Account name"
            value={accountName}
            onChangeText={setAccountName}
            data-testid="drawdown-account-name"
            placeholder="Account holder name"
          />
          <TextInput
            label="Account number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="number-pad"
            data-testid="drawdown-account-number"
            placeholder="NUBAN / account number"
          />

          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
            Supporting document
          </Text>
          <Text style={[styles.formHint, { color: palette.textSecondary }]}>
            Upload the invoice, quotation, receipt, or signed memo that justifies this remittance
            (PDF or image).
          </Text>
          <Pressable
            onPress={pickSupportDoc}
            style={[
              styles.docPicker,
              {
                borderColor: file ? palette.primary : palette.border,
                backgroundColor: palette.surfaceMuted ?? palette.surface,
              },
            ]}
            data-testid="drawdown-support-doc"
          >
            <Ionicons
              name={file ? 'document-attach' : 'cloud-upload-outline'}
              size={20}
              color={palette.primary}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.docPickerTitle, { color: palette.text }]}>
                {file ? file.name : 'Attach supporting document'}
              </Text>
              <Text style={[styles.docPickerMeta, { color: palette.textSecondary }]}>
                {file
                  ? `${Math.round((file.size ?? 0) / 1024)} KB · required evidence`
                  : 'Required · PDF, JPG, PNG, or Word'}
              </Text>
            </View>
            {file ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setFile(null);
                }}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={20} color={palette.muted} />
              </Pressable>
            ) : null}
          </Pressable>

          <Button
            title="Submit remittance request"
            onPress={() => requestMut.mutate()}
            loading={requestMut.isPending}
            disabled={
              !amountOk || !purposeOk || !accountOk || !file || requestMut.isPending
            }
            data-testid="drawdown-submit"
          />
        </View>
      ) : null}

      {!canRequest ? (
        <Text style={[styles.listHeading, { color: palette.text }]}>Incoming requests</Text>
      ) : (
        <Text style={[styles.listHeading, { color: palette.text }]}>Your requests</Text>
      )}

      {isLoading ? (
        <Text style={{ color: palette.muted }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: palette.muted }}>
          {canRequest
            ? 'No remittance requests yet — submit your first request above when you need funds.'
            : 'No project owner remittance requests yet.'}
        </Text>
      ) : (
        rows.map((row) => (
          <View
            key={row.id}
            style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.ref, { color: palette.primary }]} selectable>
                {row.reference}
              </Text>
              <Badge label={row.status} variant="accent" />
            </View>
            <Text style={[styles.amount, { color: palette.text }]}>
              {formatNaira(row.amountMinor)} · {row.category.replace(/_/g, ' ')}
            </Text>
            <Text style={[styles.purpose, { color: palette.textSecondary }]}>{row.purpose}</Text>
            {row.bankName && row.accountNumber ? (
              <Text style={[styles.purpose, { color: palette.text }]} selectable>
                Pay to · {row.bankName} · {row.accountName ?? '—'} · {row.accountNumber}
              </Text>
            ) : null}
            {row.supportDocId ? (
              <Pressable
                onPress={() => openSupportDoc(row)}
                style={styles.docLink}
                disabled={openingDocId === row.id}
              >
                {openingDocId === row.id ? (
                  <ActivityIndicator size="small" color={palette.primary} />
                ) : (
                  <Ionicons name="document-text-outline" size={16} color={palette.primary} />
                )}
                <Text style={[styles.docLinkText, { color: palette.primary }]}>
                  {row.supportDocTitle ?? row.supportDocFileName ?? 'View supporting document'}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.purpose, { color: palette.muted }]}>
                No supporting document attached
              </Text>
            )}
            {canDecide && row.status === 'PENDING' ? (
              <View style={styles.actions}>
                <Button
                  title="Reject"
                  size="sm"
                  variant="outlineDanger"
                  style={{ flex: 1 }}
                  onPress={() => decideMut.mutate({ id: row.id, approve: false })}
                />
                <Button
                  title="Approve"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => decideMut.mutate({ id: row.id, approve: true })}
                />
              </View>
            ) : null}
            {canDecide && row.status === 'APPROVED' ? (
              <Button
                title="Mark paid (reduce current capital)"
                size="sm"
                onPress={() => paidMut.mutate(row.id)}
                loading={paidMut.isPending}
              />
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginTop: spacing.sm },
  title: { fontSize: typography.sizes.lg, fontWeight: '700' },
  help: { fontSize: typography.sizes.sm, lineHeight: 20 },
  form: { gap: spacing.sm, borderWidth: 1, borderRadius: 12, padding: spacing.md },
  formTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  formHint: { fontSize: typography.sizes.xs, lineHeight: 18, marginBottom: 2 },
  fieldHint: { fontSize: typography.sizes.xs },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  docPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.md,
  },
  docPickerTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  docPickerMeta: { fontSize: typography.sizes.xs, marginTop: 2 },
  listHeading: { fontSize: typography.sizes.md, fontWeight: '600', marginTop: spacing.sm },
  card: { borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.xs },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ref: { fontFamily: typography.families.mono, fontSize: typography.sizes.xs },
  amount: { fontSize: typography.sizes.md, fontWeight: '600' },
  purpose: { fontSize: typography.sizes.sm, lineHeight: 18 },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingVertical: 4,
  },
  docLinkText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    flexShrink: 1,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
