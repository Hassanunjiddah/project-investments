import { View, Text, StyleSheet } from 'react-native';
import { useUiStore } from '@/src/store/useUiStore';

import { Card } from '@/src/components/ui/Card';
import { Badge } from '@/src/components/ui/Badge';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { formatNaira, nairaToKobo } from '@/src/utils/currency';
import { DOC_KIND_LABELS } from '@/src/types/document.types';
import { formatDuration } from '@/src/types/project.types';
import { formatFileSize } from '@/src/utils/files';
import { colors } from '@/src/constants/colors';
import { spacing } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';

type Props = {
  progressMessage?: string;
};

export function CreateProjectStepReview({ progressMessage }: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const draft = useProjectDraftStore((s) => s.draft);

  return (
    <View>
      {progressMessage ? (
        <Text style={[styles.progress, { color: palette.primary }]}>{progressMessage}</Text>
      ) : null}

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Basics</Text>
        <ReviewRow label="Name" value={draft.basics.name} />
        <ReviewRow label="Sector" value={draft.basics.sector} />
        <ReviewRow label="Location" value={draft.basics.location} />
        <ReviewRow
          label="Duration"
          value={formatDuration(draft.basics.durationValue, draft.basics.durationUnit)}
        />
        <ReviewRow label="Target" value={formatNaira(nairaToKobo(draft.basics.targetAmount))} />
        <ReviewRow
          label="Total units"
          value={
            draft.basics.totalUnits != null ? String(draft.basics.totalUnits) : '—'
          }
        />
        <ReviewRow
          label="Min units per investor"
          value={
            draft.basics.minUnitsPerInvestor != null
              ? String(draft.basics.minUnitsPerInvestor)
              : '1'
          }
        />
        <ReviewRow
          label="Raise fee"
          value={`${draft.basics.raiseFeePct ?? 2.5}% of capital raised`}
        />
        <ReviewRow
          label="Profit fee"
          value={`${draft.basics.platformFeePct ?? 7.5}% of net profit`}
        />
        <ReviewRow label="Banner" value={draft.banner ? draft.banner.fileName : 'Not provided'} />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Details</Text>
        <ReviewRow label="Summary" value={draft.details.summary} multiline />
        <ReviewRow label="Risks" value={draft.details.risks} multiline />
        <ReviewRow label="Timeline" value={draft.details.timeline} multiline />
        <ReviewRow label="Projected profit" value={`${draft.details.estimatedRoiPct}%`} />
        <ReviewRow label="Public" value={draft.details.isPublic ? 'Yes' : 'No (invite-only)'} />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Escrow bank</Text>
        <ReviewRow label="Bank" value={draft.details.bankName} />
        <ReviewRow label="Account name" value={draft.details.accountName} />
        <ReviewRow label="Account number" value={draft.details.accountNumber} />
      </Card>

      <Card>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Documents ({draft.documents.length})
        </Text>
        {draft.documents.length === 0 ? (
          <Text style={[styles.empty, { color: palette.textSecondary }]}>No attachments</Text>
        ) : (
          draft.documents.map((doc) => (
            <View key={doc.localId} style={styles.docRow}>
              <View style={styles.docInfo}>
                <Text style={[styles.docTitle, { color: palette.text }]}>{doc.title}</Text>
                <Text style={[styles.docMeta, { color: palette.textSecondary }]}>
                  {doc.fileName} · {formatFileSize(doc.sizeBytes)}
                </Text>
              </View>
              <Badge label={DOC_KIND_LABELS[doc.kind]} variant="accent" />
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];

  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.rowValue, { color: palette.text }]}
        numberOfLines={multiline ? undefined : 1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  row: {
    paddingVertical: spacing.xs,
    gap: 2,
  },
  rowLabel: {
    fontSize: typography.sizes.xs,
  },
  rowValue: {
    fontSize: typography.sizes.sm,
  },
  empty: {
    fontSize: typography.sizes.sm,
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
