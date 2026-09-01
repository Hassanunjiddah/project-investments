import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useUiStore } from '@/src/store/useUiStore';
import { colors } from '@/src/constants/colors';
import { spacing, radii } from '@/src/constants/spacing';
import { typography } from '@/src/constants/typography';
import {
  extractProjectBrief,
  uploadProjectBrief,
  type ExtractedProjectBrief,
  type UploadedBrief,
} from '@/src/services/briefExtraction.services';
import { putBriefCache, clearBriefCache } from '@/src/services/briefDraftCache';
import { useProjectDraftStore } from '@/src/store/useProjectDraftStore';
import { generateLocalId, inferMimeType } from '@/src/utils/files';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

type Props = {
  /** Set of dot-path keys the extractor filled — surfaced to Basics/Details steps
   *  so we can render "auto-filled" badges next to each field. */
  onExtracted: (
    fields: ExtractedProjectBrief,
    uploaded: UploadedBrief,
    filled: string[],
  ) => void;
  brief: UploadedBrief | null;
  extractedFields: string[];
  extractionNotes?: string;
};

export function CreateProjectStepUpload({
  onExtracted,
  brief,
  extractedFields,
  extractionNotes,
}: Props) {
  const scheme = useUiStore((s) => s.theme);
  const palette = colors[scheme];
  const pushToast = useUiStore((s) => s.pushToast);
  const draft = useProjectDraftStore((s) => s.draft);
  const setBasics = useProjectDraftStore((s) => s.setBasics);
  const setDetails = useProjectDraftStore((s) => s.setDetails);
  const addDocument = useProjectDraftStore((s) => s.addDocument);
  const removeDocument = useProjectDraftStore((s) => s.removeDocument);

  const [phase, setPhase] = useState<'idle' | 'uploading' | 'extracting'>('idle');

  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ALLOWED_TYPES,
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const lowerName = (asset.name ?? '').toLowerCase();
    if (lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) {
      pushToast({
        type: 'error',
        message:
          'Legacy .doc files are not supported. Please save as .docx or PDF and upload again.',
      });
      return;
    }

    // Convert the picker asset into a File + keep raw bytes for submit.
    // Bytes are cached so create never depends on the inbox object surviving
    // earlier failed attempts (which previously caused "Object not found").
    let uploaded: UploadedBrief;
    let briefBytes: ArrayBuffer;
    const mimeType = inferMimeType(asset.name, asset.mimeType);
    try {
      setPhase('uploading');
      if (Platform.OS === 'web' && asset.file) {
        const file = asset.file as File;
        briefBytes = await file.arrayBuffer();
        uploaded = await uploadProjectBrief(new File([briefBytes], file.name, { type: mimeType }));
      } else {
        const res = await fetch(asset.uri);
        const blob = await res.blob();
        briefBytes = await blob.arrayBuffer();
        const file = new File([briefBytes], asset.name, { type: mimeType });
        uploaded = await uploadProjectBrief(file);
      }
    } catch (err) {
      setPhase('idle');
      pushToast({
        type: 'error',
        message:
          err instanceof Error ? err.message : 'Upload failed. Please try again.',
      });
      return;
    }

    // Always register the OVERVIEW doc (even if Gemini extraction fails) so
    // the user can still submit after filling the form by hand.
    const existing = draft.documents.find((d) => d.kind === 'OVERVIEW');
    if (existing?.cacheKey) clearBriefCache(existing.cacheKey);
    if (existing) removeDocument(existing.localId);

    const cacheKey = generateLocalId();
    putBriefCache(cacheKey, {
      bytes: briefBytes,
      mimeType: uploaded.mimeType,
      fileName: uploaded.fileName,
      sizeBytes: uploaded.sizeBytes,
    });
    addDocument({
      localId: generateLocalId(),
      uri: `supabase-storage://${uploaded.bucket}/${uploaded.path}`,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      kind: 'OVERVIEW',
      title: 'Project Brief',
      cacheKey,
    });

    // Kick off extraction (best-effort).
    try {
      setPhase('extracting');
      const extracted = await extractProjectBrief(uploaded);

      const nextBasics = { ...draft.basics };
      const nextDetails = { ...draft.details };
      const filled: string[] = [];

      if (extracted.name) {
        nextBasics.name = extracted.name;
        filled.push('name');
      }
      if (extracted.sector) {
        nextBasics.sector = extracted.sector;
        filled.push('sector');
      }
      if (extracted.location) {
        nextBasics.location = extracted.location;
        filled.push('location');
      }
      if (typeof extracted.targetAmountNaira === 'number') {
        nextBasics.targetAmount = extracted.targetAmountNaira;
        filled.push('targetAmount');
      }
      if (typeof extracted.totalUnits === 'number') {
        nextBasics.totalUnits = extracted.totalUnits;
        filled.push('totalUnits');
      }
      if (typeof extracted.durationValue === 'number') {
        if (extracted.durationUnit === 'YEARS') {
          // Create/API only accept DAYS|WEEKS|MONTHS — convert years → months.
          nextBasics.durationValue = extracted.durationValue * 12;
          nextBasics.durationUnit = 'MONTHS';
          filled.push('durationValue', 'durationUnit');
        } else {
          nextBasics.durationValue = extracted.durationValue;
          filled.push('durationValue');
          if (extracted.durationUnit) {
            nextBasics.durationUnit = extracted.durationUnit;
            filled.push('durationUnit');
          }
        }
      } else if (extracted.durationUnit && extracted.durationUnit !== 'YEARS') {
        nextBasics.durationUnit = extracted.durationUnit;
        filled.push('durationUnit');
      }
      if (typeof extracted.minUnitsPerInvestor === 'number') {
        nextBasics.minUnitsPerInvestor = extracted.minUnitsPerInvestor;
        filled.push('minUnitsPerInvestor');
      }
      if (extracted.summary) {
        nextDetails.summary = extracted.summary;
        filled.push('summary');
      }
      if (extracted.fullDetails) {
        nextDetails.fullDetails = extracted.fullDetails;
        filled.push('fullDetails');
      } else if (extracted.summary && !nextDetails.fullDetails) {
        nextDetails.fullDetails = extracted.summary;
        filled.push('fullDetails');
      }
      if (extracted.risks) {
        nextDetails.risks = extracted.risks;
        filled.push('risks');
      }
      if (extracted.timeline) {
        nextDetails.timeline = extracted.timeline;
        filled.push('timeline');
      }
      if (typeof extracted.estimatedRoiPct === 'number') {
        nextDetails.estimatedRoiPct = extracted.estimatedRoiPct;
        filled.push('estimatedRoiPct');
      }
      if (typeof extracted.profitSplitInvestorPct === 'number') {
        nextDetails.managerSharePct = Math.max(0, 100 - extracted.profitSplitInvestorPct);
        filled.push('managerSharePct');
      }
      if (typeof extracted.exitNoticeDays === 'number') {
        nextDetails.exitNoticeDays = extracted.exitNoticeDays;
        filled.push('exitNoticeDays');
      }
      if (typeof extracted.earlyExitPenaltyPct === 'number') {
        nextDetails.earlyExitPenaltyBps = Math.round(extracted.earlyExitPenaltyPct * 100);
        filled.push('earlyExitPenaltyBps');
      }

      setBasics(nextBasics);
      setDetails(nextDetails);
      onExtracted({ ...extracted }, uploaded, filled);

      pushToast({
        type: 'success',
        message: `Auto-filled ${filled.length} field${filled.length === 1 ? '' : 's'} from the brief.`,
      });
    } catch (err) {
      // Brief is already attached — user can fill the form manually.
      onExtracted(
        {
          name: null,
          sector: null,
          location: null,
          summary: null,
          fullDetails: null,
          risks: null,
          timeline: null,
          targetAmountNaira: null,
          totalUnits: null,
          unitPriceNaira: null,
          durationValue: null,
          durationUnit: null,
          estimatedRoiPct: null,
          profitSplitInvestorPct: null,
          exitNoticeDays: null,
          earlyExitPenaltyPct: null,
          minUnitsPerInvestor: null,
          confidence: { overall: 0, notes: 'Extraction failed' },
        },
        uploaded,
        [],
      );
      pushToast({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Extraction failed — you can still fill the form manually on the next step.',
      });
    } finally {
      setPhase('idle');
    }
  };

  const busy = phase !== 'idle';

  return (
    <View>
      <Pressable
        onPress={handlePick}
        disabled={busy}
        style={[
          styles.dropZone,
          {
            backgroundColor: palette.surface,
            borderColor: brief ? palette.primary : palette.border,
            opacity: busy ? 0.6 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Upload project brief"
        data-testid="upload-project-brief-btn"
        testID="upload-project-brief-btn"
      >
        <View
          style={[
            styles.dropIcon,
            { backgroundColor: palette.primaryLight },
          ]}
        >
          <Ionicons
            name={brief ? 'document-text' : 'cloud-upload-outline'}
            size={22}
            color={palette.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.dropTitle, { color: palette.text }]}>
            {brief ? brief.fileName : 'Upload one project brief'}
          </Text>
          <Text style={[styles.dropMeta, { color: palette.textSecondary }]}>
            {brief
              ? `${(brief.sizeBytes / 1024 / 1024).toFixed(2)} MB · re-upload to replace`
              : 'PDF, DOCX or TXT — up to 20 MB. We\'ll read it and pre-fill the next steps.'}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={palette.primary} />
        ) : (
          <Text style={[styles.dropAction, { color: palette.primary }]}>
            {brief ? 'Replace' : 'Choose'}
          </Text>
        )}
      </Pressable>

      {phase === 'uploading' ? (
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: palette.textSecondary }]}>
            Uploading to secure storage…
          </Text>
        </View>
      ) : null}
      {phase === 'extracting' ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={palette.primary} />
          <Text style={[styles.statusText, { color: palette.textSecondary }]}>
            Reading the brief with Gemini — this usually takes 10-20 seconds.
          </Text>
        </View>
      ) : null}

      {brief && extractedFields.length > 0 ? (
        <View
          style={[
            styles.summary,
            {
              backgroundColor: palette.semantic.success.bg,
              borderColor: palette.semantic.success.border,
            },
          ]}
        >
          <View style={styles.summaryHeader}>
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={palette.semantic.success.fg}
            />
            <Text
              style={[styles.summaryTitle, { color: palette.semantic.success.fg }]}
            >
              Extracted {extractedFields.length}{' '}
              {extractedFields.length === 1 ? 'field' : 'fields'}
            </Text>
          </View>
          <Text style={[styles.summaryBody, { color: palette.text }]}>
            {extractedFields
              .map((f) => humaniseField(f))
              .join(' · ')}
          </Text>
          {extractionNotes ? (
            <Text style={[styles.summaryNote, { color: palette.textSecondary }]}>
              {extractionNotes}
            </Text>
          ) : null}
          <Text style={[styles.summaryNote, { color: palette.textSecondary }]}>
            Continue to review and edit anything you'd like to correct.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function humaniseField(k: string): string {
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

const styles = StyleSheet.create({
  dropZone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  dropIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: 2,
  },
  dropMeta: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    lineHeight: 18,
  },
  dropAction: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  summary: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.2,
  },
  summaryBody: {
    fontSize: typography.sizes.xs,
    lineHeight: 20,
    fontWeight: typography.weights.medium,
  },
  summaryNote: {
    fontSize: typography.sizes.xs,
    lineHeight: 18,
    fontStyle: 'italic',
  },
});
