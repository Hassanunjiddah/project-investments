import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Button } from '@/src/components/ui/Button';
import { CreateProjectStepLayout } from '@/src/components/projects/CreateProjectStepLayout';
import { DocumentPickerCard } from '@/src/components/projects/DocumentPickerCard';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { useUiStore } from '@/src/store/useUiStore';
import {
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENTS,
  generateLocalId,
  mapPickerAssetToDraft,
} from '@/src/utils/files';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
};

export function CreateProjectStepDocuments({ onNext, onBack, onSaveExit }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const documents = useProjectDraftStore((s) => s.draft.documents);
  const addDocument = useProjectDraftStore((s) => s.addDocument);
  const updateDocument = useProjectDraftStore((s) => s.updateDocument);
  const removeDocument = useProjectDraftStore((s) => s.removeDocument);
  const pushToast = useUiStore((s) => s.pushToast);

  const pickDocument = async () => {
    if (documents.length >= MAX_ATTACHMENTS) {
      pushToast({ type: 'error', message: `Maximum ${MAX_ATTACHMENTS} attachments allowed.` });
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    addDocument(mapPickerAssetToDraft(asset, generateLocalId()));
  };

  const validateDocuments = (): boolean => {
    for (const doc of documents) {
      if (!doc.title.trim()) {
        pushToast({ type: 'error', message: 'Each document needs a title.' });
        return false;
      }
      if (doc.kind === 'FUND_USE' && !doc.amountKobo) {
        pushToast({ type: 'error', message: `${doc.fileName}: amount required for fund use.` });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateDocuments()) return;
    onNext();
  };

  return (
    <CreateProjectStepLayout
      step={3}
      title="Documents"
      subtitle="Attach PDFs, presentations, spreadsheets, or images (optional)."
      onBack={onBack}
      onNext={handleNext}
      onSaveExit={onSaveExit}
    >
      <Button title="Add attachment" variant="secondary" onPress={pickDocument} />

      {documents.length === 0 ? (
        <Text style={[styles.empty, { color: palette.textSecondary }]}>
          No attachments yet. You can skip this step or add supporting documents.
        </Text>
      ) : (
        <View style={styles.list}>
          {documents.map((doc) => (
            <DocumentPickerCard
              key={doc.localId}
              document={doc}
              onUpdate={(patch) => updateDocument(doc.localId, patch)}
              onRemove={() => removeDocument(doc.localId)}
            />
          ))}
        </View>
      )}
    </CreateProjectStepLayout>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
  },
  list: {
    gap: spacing.md,
  },
});
