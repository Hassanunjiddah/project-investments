import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';
import { TextInput } from '@/src/components/ui/TextInput';
import { Badge } from '@/src/components/ui/Badge';
import type { DraftDocument } from '@/src/store/useProjectDraftStore';
import type { DocKind } from '@/src/types/document.types';
import { DOC_KIND_LABELS } from '@/src/types/document.types';
import { formatFileSize } from '@/src/utils/files';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  document: DraftDocument;
  onUpdate: (patch: Partial<DraftDocument>) => void;
  onRemove: () => void;
};

const KIND_OPTIONS: DocKind[] = ['OVERVIEW', 'FUND_USE', 'RISK', 'DECISION'];

export function DocumentPickerCard({ document, onUpdate, onRemove }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.fileName, { color: palette.text }]} numberOfLines={1}>
            {document.fileName}
          </Text>
          <Text style={[styles.meta, { color: palette.textSecondary }]}>
            {formatFileSize(document.sizeBytes)}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Text style={[styles.remove, { color: palette.error }]}>Remove</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionLabel, { color: palette.textSecondary }]}>Category</Text>
      <View style={styles.kinds}>
        {KIND_OPTIONS.map((kind) => (
          <Pressable key={kind} onPress={() => onUpdate({ kind })}>
            <Badge
              label={DOC_KIND_LABELS[kind]}
              variant={document.kind === kind ? 'accent' : 'default'}
            />
          </Pressable>
        ))}
      </View>

      <TextInput
        label="Title"
        value={document.title}
        onChangeText={(title) => onUpdate({ title })}
      />

      <TextInput
        label="Note (optional)"
        value={document.note ?? ''}
        onChangeText={(note) => onUpdate({ note: note || undefined })}
        multiline
      />

      {document.kind === 'FUND_USE' ? (
        <TextInput
          label="Amount (₦)"
          value={document.amountMinor ? String(document.amountMinor / 100) : ''}
          onChangeText={(text) => {
            const naira = parseFloat(text) || 0;
            onUpdate({ amountMinor: naira > 0 ? nairaToKobo(naira) : undefined });
          }}
          keyboardType="decimal-pad"
        />
      ) : null}

      {document.kind === 'FUND_USE' && document.amountMinor ? (
        <Text style={[styles.amountHint, { color: palette.textSecondary }]}>
          Fund use: {formatNaira(document.amountMinor)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  fileName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  meta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  remove: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: spacing.xs,
  },
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  amountHint: {
    fontSize: typography.sizes.xs,
  },
});
