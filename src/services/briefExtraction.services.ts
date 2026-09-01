import { supabase } from '@/src/services/supabase';
import { AppError, normalizeError } from '@/src/helpers/supabaseError';
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

async function messageFromFunctionsError(error: unknown): Promise<string | null> {
  const err = error as {
    message?: string;
    context?: Response | { json?: () => Promise<{ error?: string }> };
  };
  if (!err?.context) return err?.message ?? null;

  try {
    if (typeof Response !== 'undefined' && err.context instanceof Response) {
      const body = (await err.context.clone().json().catch(() => null)) as {
        error?: string;
      } | null;
      if (body?.error) return body.error;
      const text = await err.context.clone().text().catch(() => '');
      if (text) return text.slice(0, 240);
    }
  } catch {
    /* fall through */
  }

  try {
    const ctx = err.context as { json?: () => Promise<{ error?: string }> };
    if (typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error) return body.error;
    }
  } catch {
    /* fall through */
  }

  return err.message ?? null;
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

  return data.extracted;
}
