import { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { TextInput } from '@/src/components/ui/TextInput';
import { Button } from '@/src/components/ui/Button';
import { EmptyState } from '@/src/components/ui/EmptyState';
import { useFetchDocumentsForProject } from '@/src/hooks/documents/useFetchDocumentsForProject';
import { useUploadDocument } from '@/src/hooks/documents/useUploadDocument';
import { getDocumentSignedUrl } from '@/src/services/documents.services';
import { DOC_KIND_LABELS, type DocKind } from '@/src/types/document.types';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import moment from 'moment';

type Props = {
  projectId: string;
  canUpload: boolean;
  userId?: string;
};

const KIND_OPTIONS: DocKind[] = ['OVERVIEW', 'FUND_USE', 'RISK', 'DECISION'];

const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export function ProjectDocumentsTab({ projectId, canUpload, userId }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const { data: documents = [], isLoading, refetch } = useFetchDocumentsForProject(projectId);
  const upload = useUploadDocument(projectId);

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<DocKind>('OVERVIEW');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setFile(result.assets[0]);
      if (!title) setTitle(result.assets[0].name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleUpload = async () => {
    setError(null);
    if (!userId) {
      setError('Not authenticated.');
      return;
    }
    if (!file) {
      setError('Attach a file first.');
      return;
    }
    if (!title.trim()) {
      setError('Enter a title.');
      return;
    }
    let amountMinor: number | undefined;
    if (kind === 'FUND_USE') {
      const naira = parseFloat(amount);
      if (!Number.isFinite(naira) || naira <= 0) {
        setError('Fund-use documents require a positive amount.');
        return;
      }
      amountMinor = nairaToKobo(naira);
    }

    try {
      await upload.mutateAsync({
        userId,
        uri: file.uri,
        fileName: file.name,
        mimeType: file.mimeType ?? 'application/octet-stream',
        sizeBytes: file.size ?? 0,
        kind,
        title: title.trim(),
        note: note.trim() || undefined,
        amountMinor,
      });
      setFile(null);
      setTitle('');
      setNote('');
      setAmount('');
      setShowForm(false);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    }
  };

  const openDoc = async (docId: string, storagePath: string) => {
    try {
      setOpeningId(docId);
      const url = await getDocumentSignedUrl(storagePath);
      if (typeof window !== 'undefined') window.open(url, '_blank');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open document.');
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <View>
      {canUpload ? (
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: palette.text }]}>Documents</Text>
          <Button
            title={showForm ? 'Cancel' : 'Upload'}
            size="sm"
            variant={showForm ? 'outline' : 'primary'}
            onPress={() => setShowForm((v) => !v)}
            data-testid="toggle-doc-upload-btn"
          />
        </View>
      ) : null}

      {canUpload && showForm ? (
        <View
          style={[styles.form, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>Document type</Text>
          <View style={styles.kindRow}>
            {KIND_OPTIONS.map((k) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setKind(k)}
                  style={[
                    styles.kindChip,
                    {
                      backgroundColor: active ? palette.primary : 'transparent',
                      borderColor: active ? palette.primary : palette.border,
                    },
                  ]}
                  data-testid={`doc-kind-${k}`}
                >
                  <Text
                    style={[styles.kindText, { color: active ? '#fff' : palette.textSecondary }]}
                  >
                    {DOC_KIND_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            label="Title"
            value={title}
            onChangeText={setTitle}
            data-testid="doc-title-input"
          />

          {kind === 'FUND_USE' ? (
            <TextInput
              label="Amount (₦)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              data-testid="doc-amount-input"
            />
          ) : null}

          <TextInput
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
            data-testid="doc-note-input"
          />

          <Pressable
            onPress={pickFile}
            style={[styles.filePicker, { borderColor: palette.border }]}
            data-testid="doc-file-picker"
          >
            <Ionicons name="cloud-upload-outline" size={18} color={palette.primary} />
            <Text style={[styles.fileText, { color: palette.text }]}>
              {file ? file.name : 'Attach a PDF, image, or Office document'}
            </Text>
          </Pressable>

          {error ? <Text style={[styles.err, { color: palette.warning }]}>{error}</Text> : null}
          <Button
            title="Upload document"
            onPress={handleUpload}
            loading={upload.isPending}
            data-testid="submit-doc-btn"
          />
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={palette.primary} />
      ) : documents.length === 0 ? (
        <EmptyState
          title="No documents"
          message={
            canUpload
              ? 'Upload overviews, risk assessments, fund-use statements and key decisions.'
              : 'The line manager has not uploaded any documents yet.'
          }
        />
      ) : (
        documents.map((doc) => (
          <Pressable
            key={doc.id}
            onPress={() => openDoc(doc.id, doc.storagePath)}
            style={[
              styles.docRow,
              { borderColor: palette.border, backgroundColor: palette.surface },
            ]}
            data-testid={`doc-row-${doc.id}`}
          >
            <Ionicons name="document-outline" size={18} color={palette.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.docTitle, { color: palette.text }]}>{doc.title}</Text>
              <Text style={[styles.docMeta, { color: palette.muted }]}>
                {DOC_KIND_LABELS[doc.kind]} · {doc.fileName}
                {doc.amountMinor ? ` · ${formatNaira(doc.amountMinor)}` : ''}
              </Text>
              {doc.note ? (
                <Text style={[styles.docNote, { color: palette.textSecondary }]}>{doc.note}</Text>
              ) : null}
              <Text style={[styles.docMeta, { color: palette.muted, marginTop: 2 }]}>
                {moment(doc.createdAt).fromNow()}
              </Text>
            </View>
            {openingId === doc.id ? (
              <ActivityIndicator color={palette.primary} size="small" />
            ) : (
              <Ionicons name="open-outline" size={16} color={palette.muted} />
            )}
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  form: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  kindChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  kindText: {
    fontSize: 11,
    fontWeight: typography.weights.medium,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: spacing.md,
  },
  fileText: {
    flex: 1,
    fontSize: typography.sizes.sm,
  },
  err: { fontSize: typography.sizes.xs },
  docRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  docTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  docMeta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  docNote: {
    fontSize: typography.sizes.xs,
    marginTop: 4,
    lineHeight: 16,
  },
});
