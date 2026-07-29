import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import { inferMimeType } from '@/src/utils/files';

/**
 * Shape returned by the `extract-project-brief` edge function.
 * Every field can be `null` if the model could not confidently extract it —
 * the wizard displays whatever came back and lets the user fill blanks.
 */
export type ExtractedProjectBrief = {
  name: string | null;
  sector: string | null;
  location: string | null;
  summary: string | null;
  fullDetails: string | null;
  risks: string | null;
  timeline: string | null;
  targetAmountNaira: number | null;
  totalUnits: number | null;
  unitPriceNaira: number | null;
  durationValue: number | null;
  durationUnit: 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS' | null;
  estimatedRoiPct: number | null;
  profitSplitInvestorPct: number | null;
  exitNoticeDays: number | null;
  earlyExitPenaltyPct: number | null;
  minUnitsPerInvestor: number | null;
  confidence: {
    overall: number;
    notes: string;
  };
};

export type ExtractBriefResponse = {
  ok: true;
  extracted: ExtractedProjectBrief;
  model: string;
};

export type UploadedBrief = {
  bucket: string;
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/**
 * Uploads a project-brief document to the `project-documents` bucket under
 * an `inbox/` prefix so it can be picked up by the extractor. The wizard
 * will move / rename the file into the canonical project folder after the
 * project is created.
 */
export async function uploadProjectBrief(file: File): Promise<UploadedBrief> {
  const bucket = 'project-documents';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `inbox/${crypto.randomUUID()}-${safeName}`;
  const mimeType = inferMimeType(file.name, file.type);

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw normalizeError(error);

  return {
    bucket,
    path,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
  };
}

/**
 * Invokes the `extract-project-brief` edge function. Returns the extracted
 * fields plus a confidence score. Any Gemini / network error is normalised
 * to a throwable Error with a user-friendly message.
 */
export async function extractProjectBrief(
  brief: UploadedBrief,
): Promise<ExtractedProjectBrief> {
  const { data, error } = await supabase.functions.invoke<ExtractBriefResponse>(
    'extract-project-brief',
    {
      body: {
        bucket: brief.bucket,
        path: brief.path,
        mimeType: brief.mimeType,
      },
    },
  );
  if (error) throw new Error(error.message ?? 'Extractor unavailable.');
  if (!data?.ok) throw new Error('Extraction failed.');
  return data.extracted;
}
