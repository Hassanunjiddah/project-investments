import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import {
  cancelDocumentRequest,
  fulfillDocumentRequest,
  listDocumentRequests,
  requestProjectDocument,
  type DocumentRequest,
} from '@/src/services/documentRequests.services';
import { DOC_KIND_LABELS, type DocKind } from '@/src/types/document.types';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { queryKeys } from '@/src/constants/query-keys';
import { normalizeError } from '@/src/helpers/supabaseError';
import moment from 'moment';

type Props = {
  projectId: string;
  /** Staff LM/CEO can upload for everyone to see. */
  canUpload: boolean;
  /** Staff can request a file from the assigned project owner. */
  canRequestFromOwner: boolean;
  /** Assigned project owner can fulfill pending requests (and upload). */
  isOriginator: boolean;
  userId?: string;
  /** Deep-link highlight from `?request=` */
  focusRequestId?: string | null;
  hasProjectOwner: boolean;
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

export function ProjectDocumentsTab({
  projectId,
  canUpload,
  canRequestFromOwner,
  isOriginator,
  userId,
  focusRequestId,
  hasProjectOwner,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const queryClient = useQueryClient();
  const { data: documents = [], isLoading, refetch } = useFetchDocumentsForProject(projectId);
  const upload = useUploadDocument(projectId);

  const { data: requests = [], refetch: refetchRequests } = useQuery({
    queryKey: queryKeys.documents.requests(projectId),
    queryFn: () => listDocumentRequests(projectId),
    enabled: !!projectId && (canRequestFromOwner || isOriginator || canUpload),
  });

  const [mode, setMode] = useState<'idle' | 'upload' | 'request'>('idle');
  const [fulfillRequestId, setFulfillRequestId] = useState<string | null>(focusRequestId ?? null);
  const [kind, setKind] = useState<DocKind>('OVERVIEW');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (focusRequestId) {
      setFulfillRequestId(focusRequestId);
      setMode('upload');
      const match = requests.find((r) => r.id === focusRequestId);
      if (match) {
        setKind(match.docKind);
        setTitle(match.title);
        setNote(match.note ?? '');
      }
    }
  }, [focusRequestId, requests]);

  const pendingRequests = requests.filter((r) => r.status === 'PENDING');
  const canShowUpload = canUpload || isOriginator;

  const requestMutation = useMutation({
    mutationFn: () =>
      requestProjectDocument({
        projectId,
        kind,
        title: title.trim(),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.requests(projectId) });
      pushToast({ type: 'success', message: 'Document request sent to the project owner.' });
      resetForm();
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : 'Could not send request.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelDocumentRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.requests(projectId) });
      pushToast({ type: 'info', message: 'Request cancelled.' });
    },
    onError: (e) => {
      pushToast({
        type: 'error',
        message: e instanceof Error ? e.message : 'Could not cancel request.',
      });
    },
  });

  const resetForm = () => {
    setFile(null);
    setTitle('');
    setNote('');
    setAmount('');
    setError(null);
    setMode('idle');
    setFulfillRequestId(null);
    setKind('OVERVIEW');
  };

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

  const startFulfill = (req: DocumentRequest) => {
    setFulfillRequestId(req.id);
    setKind(req.docKind);
    setTitle(req.title);
    setNote(req.note ?? '');
    setMode('upload');
    setError(null);
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
      const doc = await upload.mutateAsync({
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

      if (fulfillRequestId) {
        try {
          await fulfillDocumentRequest(fulfillRequestId, doc.id);
          await refetchRequests();
          pushToast({ type: 'success', message: 'Document uploaded and request fulfilled.' });
        } catch (fulfillErr) {
          pushToast({
            type: 'error',
            message:
              fulfillErr instanceof Error
                ? fulfillErr.message
                : 'Uploaded, but could not mark the request fulfilled.',
          });
        }
      } else {
        pushToast({ type: 'success', message: 'Document uploaded.' });
      }

      resetForm();
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    }
  };

  const handleRequest = () => {
    setError(null);
    if (!hasProjectOwner) {
      setError('Assign a project owner first (Owner panel on Overview).');
      return;
    }
    if (!title.trim()) {
      setError('Enter a title for the requested document.');
      return;
    }
    requestMutation.mutate();
  };

  const openDoc = async (docId: string, storagePath: string) => {
    try {
      setOpeningId(docId);
      const url = await getDocumentSignedUrl(storagePath);
      if (typeof window !== 'undefined') window.open(url, '_blank');
    } catch (e) {
      setError(normalizeError(e).message);
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: palette.text }]}>Documents</Text>
        <View style={styles.headerActions}>
          {canRequestFromOwner ? (
            <Button
              title={mode === 'request' ? 'Cancel' : 'Request from owner'}
              size="sm"
              variant={mode === 'request' ? 'outline' : 'outline'}
              onPress={() => {
                setError(null);
                setMode((m) => (m === 'request' ? 'idle' : 'request'));
                setFulfillRequestId(null);
              }}
              data-testid="toggle-doc-request-btn"
            />
          ) : null}
          {canShowUpload ? (
            <Button
              title={mode === 'upload' ? 'Cancel' : 'Upload'}
              size="sm"
              variant={mode === 'upload' ? 'outline' : 'primary'}
              onPress={() => {
                setError(null);
                setMode((m) => (m === 'upload' ? 'idle' : 'upload'));
                if (mode !== 'upload') setFulfillRequestId(null);
              }}
              data-testid="toggle-doc-upload-btn"
            />
          ) : null}
        </View>
      </View>

      {pendingRequests.length > 0 ? (
        <View style={styles.requestsBlock}>
          <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>
            Pending requests ({pendingRequests.length})
          </Text>
          {pendingRequests.map((req) => {
            const focused = req.id === fulfillRequestId || req.id === focusRequestId;
            return (
              <View
                key={req.id}
                style={[
                  styles.requestRow,
                  {
                    borderColor: focused ? palette.primary : palette.border,
                    backgroundColor: focused ? palette.primaryLight : palette.surface,
                  },
                ]}
                data-testid={`doc-request-${req.id}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.docTitle, { color: palette.text }]}>{req.title}</Text>
                  <Text style={[styles.docMeta, { color: palette.muted }]}>
                    {DOC_KIND_LABELS[req.docKind]} · requested {moment(req.createdAt).fromNow()}
                  </Text>
                  {req.note ? (
                    <Text style={[styles.docNote, { color: palette.textSecondary }]}>{req.note}</Text>
                  ) : null}
                </View>
                {isOriginator ? (
                  <Button
                    title="Upload"
                    size="sm"
                    onPress={() => startFulfill(req)}
                    data-testid={`fulfill-doc-request-${req.id}`}
                  />
                ) : canRequestFromOwner ? (
                  <Button
                    title="Cancel"
                    size="sm"
                    variant="outline"
                    onPress={() => cancelMutation.mutate(req.id)}
                    loading={cancelMutation.isPending}
                    data-testid={`cancel-doc-request-${req.id}`}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {mode === 'request' && canRequestFromOwner ? (
        <View
          style={[styles.form, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          <Text style={[styles.formLabel, { color: palette.text }]}>
            Request a document from the project owner
          </Text>
          {!hasProjectOwner ? (
            <Text style={[styles.err, { color: palette.warning }]}>
              No project owner assigned yet. Assign one on the Overview tab first.
            </Text>
          ) : null}
          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>Document type</Text>
          <KindChips kind={kind} setKind={setKind} palette={palette} />
          <TextInput
            label="What do you need?"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Signed remittance schedule"
            data-testid="doc-request-title-input"
          />
          <TextInput
            label="Note to owner (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={2}
            data-testid="doc-request-note-input"
          />
          {error ? <Text style={[styles.err, { color: palette.warning }]}>{error}</Text> : null}
          <Button
            title="Send request"
            onPress={handleRequest}
            loading={requestMutation.isPending}
            data-testid="submit-doc-request-btn"
          />
        </View>
      ) : null}

      {mode === 'upload' && canShowUpload ? (
        <View
          style={[styles.form, { borderColor: palette.border, backgroundColor: palette.surface }]}
        >
          {fulfillRequestId ? (
            <Text style={[styles.formLabel, { color: palette.primary }]}>
              Fulfilling owner request — upload the file below
            </Text>
          ) : (
            <Text style={[styles.formLabel, { color: palette.textSecondary }]}>
              Upload a document visible to project participants
            </Text>
          )}
          <Text style={[styles.formLabel, { color: palette.textSecondary }]}>Document type</Text>
          <KindChips kind={kind} setKind={setKind} palette={palette} />

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
            title={fulfillRequestId ? 'Upload & fulfill request' : 'Upload document'}
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
            canShowUpload
              ? 'Upload overviews, risk assessments, fund-use statements and key decisions.'
              : 'Prism has not uploaded any documents for this project yet.'
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

function KindChips({
  kind,
  setKind,
  palette,
}: {
  kind: DocKind;
  setKind: (k: DocKind) => void;
  palette: (typeof colors)['light'];
}) {
  return (
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
            <Text style={[styles.kindText, { color: active ? '#fff' : palette.textSecondary }]}>
              {DOC_KIND_LABELS[k]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  requestsBlock: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: 10,
    borderWidth: 1,
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
