import { supabase } from '@/src/services/supabase';
import {
  AppError,
  normalizeError,
  messageFromFunctionsError,
} from '@/src/helpers/supabaseError';
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
  const { data, error } = await supabase.functions.invoke<
    ExtractBriefResponse | { error?: string; ok?: false }
  >('extract-project-brief', {
    body: {
      bucket: brief.bucket,
      path: brief.path,
      mimeType: brief.mimeType,
    },
  });

  if (error) {
    const fromBody = await messageFromFunctionsError(error);
    const fromData =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : null;
    throw new AppError(
      fromData ||
        fromBody ||
        'Brief extraction failed. Please retry, or continue and fill the form manually.',
    );
  }

  if (!data || typeof data !== 'object' || !('ok' in data) || !data.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Extraction failed.';
    throw new AppError(msg);
  }

  return normalizeExtractedClient(data.extracted);
}

/** Coerce string numbers / odd shapes so the wizard always sees clean types. */
function normalizeExtractedClient(raw: ExtractedProjectBrief): ExtractedProjectBrief {
  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v.replace(/[₦$,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const int = (v: unknown): number | null => {
    const n = num(v);
    if (n == null || n <= 0) return null;
    return Math.round(n);
  };
  const str = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t ? t : null;
  };
  const pct = (v: unknown): number | null => {
    const n = num(v);
    if (n == null || n < 0) return null;
    if (n > 0 && n <= 1) return Math.round(n * 10000) / 100;
    if (n > 100) return null;
    return n;
  };
  const unit = (v: unknown): ExtractedProjectBrief['durationUnit'] => {
    if (typeof v !== 'string') return null;
    const u = v.trim().toUpperCase();
    if (u === 'DAY') return 'DAYS';
    if (u === 'WEEK') return 'WEEKS';
    if (u === 'MONTH') return 'MONTHS';
    if (u === 'YEAR') return 'YEARS';
    if (u === 'DAYS' || u === 'WEEKS' || u === 'MONTHS' || u === 'YEARS') return u;
    return null;
  };

  const confidence = raw?.confidence ?? { overall: 0, notes: '' };
  let overall = num(confidence.overall) ?? 0;
  if (overall > 1 && overall <= 100) overall = overall / 100;

  return {
    name: str(raw?.name),
    sector: str(raw?.sector),
    location: str(raw?.location),
    summary: str(raw?.summary),
    fullDetails: str(raw?.fullDetails),
    risks: str(raw?.risks),
    timeline: str(raw?.timeline),
    targetAmountNaira: num(raw?.targetAmountNaira),
    totalUnits: int(raw?.totalUnits),
    unitPriceNaira: num(raw?.unitPriceNaira),
    durationValue: int(raw?.durationValue),
    durationUnit: unit(raw?.durationUnit),
    estimatedRoiPct: pct(raw?.estimatedRoiPct),
    profitSplitInvestorPct: pct(raw?.profitSplitInvestorPct),
    exitNoticeDays: int(raw?.exitNoticeDays),
    earlyExitPenaltyPct: pct(raw?.earlyExitPenaltyPct),
    minUnitsPerInvestor: int(raw?.minUnitsPerInvestor),
    confidence: {
      overall: Math.min(1, Math.max(0, overall)),
      notes: str(confidence.notes) ?? '',
    },
  };
}
