import { View, Text, StyleSheet, useColorScheme, TextInput } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/src/components/ui/Button';
import { CreateProjectStepLayout } from '@/src/components/projects/CreateProjectStepLayout';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { useUiStore } from '@/src/store/useUiStore';
import {
  ALLOWED_MIME_TYPES,
  generateLocalId,
  mapPickerAssetToDraft,
} from '@/src/utils/files';
import { type DocKind } from '@/src/types/document.types';
import { nairaToKobo } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  onNext: () => void;
  onBack: () => void;
  onSaveExit: () => void;
};

const REQUIRED_SLOTS: { kind: DocKind; title: string }[] = [
  { kind: 'OVERVIEW', title: 'Project Overview' },
  { kind: 'FUND_USE', title: 'Fund Use Statement' },
  { kind: 'RISK', title: 'Risk Assessment' },
  { kind: 'DECISION', title: 'Key Decision' },
];

export function CreateProjectStepDocuments({ onNext, onBack, onSaveExit }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = colors[scheme];
  const documents = useProjectDraftStore((s) => s.draft.documents);
  const addDocument = useProjectDraftStore((s) => s.addDocument);
  const updateDocument = useProjectDraftStore((s) => s.updateDocument);
  const removeDocument = useProjectDraftStore((s) => s.removeDocument);
  const pushToast = useUiStore((s) => s.pushToast);

  const pickForKind = async (kind: DocKind, title: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const existing = documents.find((d) => d.kind === kind);
    if (existing) removeDocument(existing.localId);

    const asset = result.assets[0];
    const draft = mapPickerAssetToDraft(asset, generateLocalId());
    addDocument({ ...draft, kind, title });
  };

  const validateDocuments = (): boolean => {
    for (const slot of REQUIRED_SLOTS) {
      const doc = documents.find((d) => d.kind === slot.kind);
      if (!doc) {
        pushToast({ type: 'error', message: `${slot.title} is required.` });
        return false;
      }
      if (doc.kind === 'FUND_USE' && !doc.amountMinor) {
        pushToast({ type: 'error', message: 'Fund Use Statement requires an amount.' });
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
      subtitle="Upload all four required documents for CEO review."
      onBack={onBack}
      onNext={handleNext}
      onSaveExit={onSaveExit}
    >
      <View style={styles.list}>
        {REQUIRED_SLOTS.map((slot) => {
          const doc = documents.find((d) => d.kind === slot.kind);
          return (
            <View
              key={slot.kind}
              style={[styles.slot, { borderColor: palette.border, backgroundColor: palette.surface }]}
            >
              <Ionicons name="document-outline" size={18} color={palette.primary} />
              <View style={styles.slotBody}>
                <Text style={[styles.slotTitle, { color: palette.text }]}>{slot.title}</Text>
                <Text style={[styles.slotMeta, { color: palette.muted }]}>
                  {doc ? doc.fileName : 'PDF, DOC (Max 10MB)'}
                </Text>
                {doc?.kind === 'FUND_USE' ? (
                  <TextInput
                    style={[
                      styles.amountInput,
                      { borderColor: palette.border, color: palette.text },
                    ]}
                    placeholder="Fund use amount (₦)"
                    placeholderTextColor={palette.muted}
                    keyboardType="decimal-pad"
                    value={doc.amountMinor ? String(doc.amountMinor / 100) : ''}
                    onChangeText={(text) => {
                      const naira = parseFloat(text) || 0;
                      updateDocument(doc.localId, {
                        amountMinor: naira > 0 ? nairaToKobo(naira) : undefined,
                      });
                    }}
                  />
                ) : null}
              </View>
              <Button
                title={doc ? 'Replace' : 'Upload'}
                variant="outline"
                size="sm"
                onPress={() => pickForKind(slot.kind, slot.title)}
              />
            </View>
          );
        })}
      </View>
    </CreateProjectStepLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.sm,
  },
  slotBody: { flex: 1 },
  slotTitle: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold },
  slotMeta: { fontSize: typography.sizes.xs, marginTop: 2 },
  amountInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.xs,
    fontSize: typography.sizes.sm,
  },
});
