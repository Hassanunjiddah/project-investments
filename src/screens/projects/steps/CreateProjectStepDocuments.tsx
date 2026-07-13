import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';

import { Button } from '@/src/components/ui/Button';
import { type DocKind } from '@/src/types/document.types';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import { REQUIRED_SLOTS } from '../CreateProjectWizard';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { ALLOWED_MIME_TYPES, generateLocalId, mapPickerAssetToDraft } from '@/src/utils/files';

export function CreateProjectStepDocuments() {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const documents = useProjectDraftStore((s) => s.draft.documents);
  const addDocument = useProjectDraftStore((s) => s.addDocument);
  const removeDocument = useProjectDraftStore((s) => s.removeDocument);

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

  return (
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
            </View>
            <Button
              title={doc ? 'Replace' : 'Upload'}
              variant={doc ? 'outlineDanger' : 'outline'}
              size="sm"
              onPress={() => pickForKind(slot.kind, slot.title)}
            />
          </View>
        );
      })}
    </View>
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
});
