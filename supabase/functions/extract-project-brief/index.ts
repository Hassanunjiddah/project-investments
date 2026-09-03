// -----------------------------------------------------------------------------
// extract-project-brief — Gemini structured extraction
//
// Called by the Create Project wizard once the LM uploads a project brief
// (PDF / DOCX / TXT). Downloads from storage, extracts text for Word docs,
// then asks Gemini for a strict JSON payload the wizard can pre-fill.
//
// Secrets: EMERGENT_LLM_KEY or GEMINI_API_KEY
// Auth: LINE_MANAGER | CEO | ADMIN
// -----------------------------------------------------------------------------
import { handleCors } from '../_shared/cors.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import {
  createServiceClient,
  createUserClient,
  requireUser,
} from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import JSZip from 'npm:jszip@3.10.1';

/** Prefer current Flash IDs (as of 2026). gemini-2.0-flash was shut down
 *  2026-06-01; gemini-flash-latest alone has been flaky across alias flips. */
const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
] as const;

const GEMINI_TIMEOUT_MS = 55_000;
/** Inline PDF payload soft limit — larger files often 413/400 at Google. */
const MAX_PDF_BYTES = 15 * 1024 * 1024;

/**
 * Gemini responseSchema uses an OpenAPI subset. Avoid enum+nullable combos
 * (Google often 400s them) — validate durationUnit in sanitizeExtracted.
 */
const briefSchema = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', nullable: true },
    sector: { type: 'STRING', nullable: true },
    location: { type: 'STRING', nullable: true },
    summary: { type: 'STRING', nullable: true },
    fullDetails: { type: 'STRING', nullable: true },
    risks: { type: 'STRING', nullable: true },
    timeline: { type: 'STRING', nullable: true },
    targetAmountNaira: { type: 'NUMBER', nullable: true },
    totalUnits: { type: 'INTEGER', nullable: true },
    unitPriceNaira: { type: 'NUMBER', nullable: true },
    durationValue: { type: 'INTEGER', nullable: true },
    durationUnit: { type: 'STRING', nullable: true },
    estimatedRoiPct: { type: 'NUMBER', nullable: true },
    profitSplitInvestorPct: { type: 'NUMBER', nullable: true },
    exitNoticeDays: { type: 'INTEGER', nullable: true },
    earlyExitPenaltyPct: { type: 'NUMBER', nullable: true },
    minUnitsPerInvestor: { type: 'INTEGER', nullable: true },
    confidence: {
      type: 'OBJECT',
      properties: {
        overall: { type: 'NUMBER' },
        notes: { type: 'STRING' },
      },
      required: ['overall', 'notes'],
      nullable: false,
    },
  },
  required: [
    'name',
    'sector',
    'location',
    'summary',
    'fullDetails',
    'risks',
    'timeline',
    'targetAmountNaira',
    'totalUnits',
    'unitPriceNaira',
    'durationValue',
    'durationUnit',
    'estimatedRoiPct',
    'profitSplitInvestorPct',
    'exitNoticeDays',
    'earlyExitPenaltyPct',
    'minUnitsPerInvestor',
    'confidence',
  ],
};

const SYSTEM_PROMPT = `You are a document extraction assistant for Prism Capital,
an institutional private-placement platform.

TASK:
- Read the attached project brief carefully.
- Extract ONLY the fields defined in the JSON schema.
- For any field that is not clearly stated in the document, return null
  (never guess or infer).

FIELD SEMANTICS:
- name:                    Short project name (e.g. "Kano Solar Cold Chain").
- sector:                  Business sector (e.g. "Agriculture", "Renewable Energy").
- location:                Primary location / city / state.
- summary:                 One-paragraph elevator pitch (max ~500 chars).
- fullDetails:             Longer prose describing the project scope, market
                           opportunity, and use-of-funds.
- risks:                   Risks section as a single string. Preserve bullet
                           list formatting using newlines and "• " prefix
                           where appropriate.
- timeline:                Project milestones as a single string with newlines.
- targetAmountNaira:       Total raise in Nigerian Naira (₦), as a plain number.
                           Examples: "₦250 million" → 250000000; "250M" → 250000000.
                           Never return kobo. Never include currency symbols.
- totalUnits:              Number of units the raise is broken into.
- unitPriceNaira:          Naira per unit. Derive if targetAmount and totalUnits
                           are both present.
- durationValue + durationUnit: Investment tenor. durationUnit MUST be one of
                           DAYS, WEEKS, MONTHS, YEARS (uppercase) or null.
- estimatedRoiPct:         Investor gross ROI over the tenor as a percent
                           0–100 (e.g. 20 means 20%). NOT a 0–1 decimal.
- profitSplitInvestorPct:  Investor share of the distributable pool as a percent
                           0–100 (e.g. 70 means investors get 70%, manager 30%).
- exitNoticeDays:          Notice period for early exit, in days.
- earlyExitPenaltyPct:     Penalty for exiting early, as a percent 0–100.
- minUnitsPerInvestor:     Minimum units a single investor must subscribe.
- confidence:              overall = 0..1 confidence; notes = short human-readable
                           reason for any unfilled fields.

Return ONLY the JSON — no prose, no markdown fences.`;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const userClient = createUserClient(req);
    const user = await requireUser(userClient);
    const role = await getUserRole(userClient, user.id);
    assertRole(
      role,
      ['LINE_MANAGER', 'CEO', 'ADMIN'],
      'Only Line Managers, CEO, or admins can extract project briefs.',
    );

    const body = await req.json().catch(() => ({}));
    const bucket: string = body.bucket ?? 'project-documents';
    const path: string | undefined = body.path;
    const mimeType: string = body.mimeType ?? 'application/pdf';
    if (!path || typeof path !== 'string') {
      throw new HttpError(400, 'Missing `path` in request body.');
    }
    // Only allow our brief buckets / inbox paths — never arbitrary storage.
    if (bucket !== 'project-documents') {
      throw new HttpError(400, 'Invalid storage bucket for brief extraction.');
    }
    if (path.includes('..') || path.startsWith('/')) {
      throw new HttpError(400, 'Invalid storage path.');
    }

    const service = createServiceClient();
    const { data: file, error: dlError } = await service.storage
      .from(bucket)
      .download(path);
    if (dlError || !file) {
      throw new HttpError(
        404,
        `Failed to download brief from storage: ${dlError?.message ?? 'unknown error'}`,
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());

    if (bytes.length === 0) {
      throw new HttpError(422, 'The uploaded brief file is empty.');
    }
    if (bytes.length > 20 * 1024 * 1024) {
      throw new HttpError(
        413,
        'Project brief is larger than 20MB. Please compress the file or split it before uploading.',
      );
    }

    const lowerPath = path.toLowerCase();
    const isDocx =
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerPath.endsWith('.docx');
    const isLegacyDoc =
      mimeType === 'application/msword' ||
      (lowerPath.endsWith('.doc') && !lowerPath.endsWith('.docx'));
    const isTxt =
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      lowerPath.endsWith('.txt') ||
      lowerPath.endsWith('.md');
    const isPdf = mimeType === 'application/pdf' || lowerPath.endsWith('.pdf');

    if (isLegacyDoc) {
      throw new HttpError(
        415,
        'Legacy .doc Word format is not supported. Please save/export as .docx or PDF and upload again.',
      );
    }

    let userParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >;

    if (isPdf) {
      if (bytes.length > MAX_PDF_BYTES) {
        throw new HttpError(
          413,
          'PDF is too large for Gemini inline reading (15MB max). Compress it, or export a shorter DOCX/TXT brief.',
        );
      }
      userParts = [
        { text: 'Extract the project brief fields from the attached document.' },
        { inlineData: { mimeType: 'application/pdf', data: toBase64(bytes) } },
      ];
    } else if (isDocx) {
      const docText = await docxToText(bytes);
      if (!docText.trim()) {
        throw new HttpError(
          422,
          'Could not extract any text from the DOCX file. It may be image-only — please export it to PDF and upload again.',
        );
      }
      userParts = [
        {
          text:
            'Extract the project brief fields from the following Word document text:\n\n---\n' +
            docText.slice(0, 200_000) +
            '\n---',
        },
      ];
    } else if (isTxt) {
      const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      if (!rawText.trim()) {
        throw new HttpError(422, 'The uploaded text file is empty.');
      }
      userParts = [
        {
          text:
            'Extract the project brief fields from the following plain-text brief:\n\n---\n' +
            rawText.slice(0, 200_000) +
            '\n---',
        },
      ];
    } else {
      throw new HttpError(
        415,
        `Unsupported brief format (${mimeType || 'unknown'}). Please upload a PDF, DOCX or TXT file.`,
      );
    }

    const apiKey =
      Deno.env.get('EMERGENT_LLM_KEY') ?? Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new HttpError(
        500,
        'Missing EMERGENT_LLM_KEY (or GEMINI_API_KEY) edge-function secret.',
      );
    }

    const { model, json: geminiJson } = await callGeminiWithFallback(
      apiKey,
      userParts,
    );

    const candidate = (geminiJson?.candidates as Array<Record<string, unknown>> | undefined)?.[0];
    const finishReason = candidate?.finishReason as string | undefined;
    if (
      finishReason &&
      finishReason !== 'STOP' &&
      finishReason !== 'MAX_TOKENS'
    ) {
      throw new HttpError(
        502,
        `Gemini stopped extraction (${finishReason}). Try a cleaner PDF/DOCX, or fill the form manually.`,
      );
    }

    const parts = (candidate?.content as { parts?: Array<{ text?: string }> } | undefined)
      ?.parts;
    const rawText: string =
      parts?.map((p) => p.text ?? '').join('') ?? '';

    if (!rawText.trim()) {
      const feedback = geminiJson?.promptFeedback as
        | { blockReason?: string }
        | undefined;
      const errObj = geminiJson?.error as { message?: string } | undefined;
      const block = feedback?.blockReason ?? errObj?.message ?? 'empty response';
      throw new HttpError(
        502,
        `Gemini returned no extraction payload (${block}). Please retry or fill the form manually.`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripMarkdownFences(rawText));
    } catch (parseErr) {
      const repaired = tryRepairJson(rawText);
      if (repaired == null) {
        console.error(
          'Failed to parse Gemini JSON',
          parseErr,
          rawText.slice(0, 500),
        );
        throw new HttpError(
          502,
          'The extractor returned malformed JSON. Please try again with a cleaner document.',
        );
      }
      parsed = repaired;
    }

    const extracted = sanitizeExtracted(parsed);
    return jsonResponse({ ok: true, extracted, model });
  } catch (err) {
    return errorResponse(err);
  }
});

async function callGeminiWithFallback(
  apiKey: string,
  userParts: Array<
    | { text: string }
    | { inlineData: { mimeType: string; data: string } }
  >,
): Promise<{ model: string; json: Record<string, unknown> }> {
  let lastStatus = 0;
  let lastBody = '';

  // First pass: strict JSON schema. Second pass (if every model rejects the
  // schema): JSON mime type only — we still parse the returned object.
  const modes: Array<'schema' | 'json'> = ['schema', 'json'];

  for (const mode of modes) {
    for (const model of GEMINI_MODELS) {
      const endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      const generationConfig: Record<string, unknown> = {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 8192,
      };
      if (mode === 'schema') {
        generationConfig.responseSchema = briefSchema;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
      let geminiRes: Response;
      try {
        geminiRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: userParts }],
            generationConfig,
          }),
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const aborted = err instanceof Error && err.name === 'AbortError';
        lastStatus = aborted ? 504 : 502;
        lastBody = aborted
          ? JSON.stringify({ error: { message: 'Gemini request timed out' } })
          : JSON.stringify({
              error: {
                message: err instanceof Error ? err.message : 'fetch failed',
              },
            });
        console.error('Gemini fetch error', model, mode, lastBody);
        continue;
      }
      clearTimeout(timer);

      if (geminiRes.ok) {
        const json = (await geminiRes.json()) as Record<string, unknown>;
        return { model: `${model}/${mode}`, json };
      }

      lastStatus = geminiRes.status;
      lastBody = await geminiRes.text();
      console.error('Gemini error', model, mode, lastStatus, lastBody.slice(0, 800));

      // Auth / billing issues won't recover by switching models.
      if (lastStatus === 401 || lastStatus === 403) break;
      // Try next model on not-found, rate-limit, overload, or bad-request
      // (schema/model mismatches are often 400).
      if (
        lastStatus === 404 ||
        lastStatus === 429 ||
        lastStatus === 400 ||
        lastStatus === 500 ||
        lastStatus === 503
      ) {
        continue;
      }
      break;
    }
    if (lastStatus === 401 || lastStatus === 403) break;
  }

  const detail = summariseGeminiError(lastBody);
  throw new HttpError(
    502,
    `Gemini extraction failed (${lastStatus})${detail ? `: ${detail}` : ''}. Please retry, or fill the form manually.`,
  );
}

function summariseGeminiError(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string };
    };
    const msg = parsed?.error?.message ?? '';
    if (!msg) return '';
    // Keep toast readable — trim long Google boilerplate.
    return msg.length > 180 ? `${msg.slice(0, 177)}…` : msg;
  } catch {
    return body ? body.slice(0, 120) : '';
  }
}

function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

/** Best-effort repair for truncated JSON when finishReason=MAX_TOKENS. */
function tryRepairJson(raw: string): unknown | null {
  let text = stripMarkdownFences(raw);
  const start = text.indexOf('{');
  if (start < 0) return null;
  text = text.slice(start);

  // Trim after last complete string/object boundary heuristics.
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }

  // Close open braces/brackets and drop a trailing incomplete key/value.
  text = text.replace(/,\s*"[^"]*$/, '');
  text = text.replace(/,\s*$/, '');
  const opens = (text.match(/{/g) ?? []).length;
  const closes = (text.match(/}/g) ?? []).length;
  const openArr = (text.match(/\[/g) ?? []).length;
  const closeArr = (text.match(/]/g) ?? []).length;
  text += ']'.repeat(Math.max(0, openArr - closeArr));
  text += '}'.repeat(Math.max(0, opens - closes));
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(bin);
}

async function docxToText(bytes: Uint8Array): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (err) {
    throw new HttpError(
      400,
      `Could not open DOCX archive: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }

  // Main body first, then headers/footers/notes (often hold title / amounts).
  const preferred = [
    'word/document.xml',
    ...Object.keys(zip.files)
      .filter(
        (n) =>
          /^word\/(header|footer|footnotes|endnotes)\d*\.xml$/i.test(n),
      )
      .sort(),
  ];

  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const name of preferred) {
    if (seen.has(name)) continue;
    seen.add(name);
    const entry = zip.file(name);
    if (!entry) continue;
    const xml = await entry.async('string');
    const text = xmlToParagraphs(xml);
    if (text.trim()) chunks.push(text);
  }

  if (chunks.length === 0) {
    // Last resort: any other word/*.xml with text runs.
    for (const name of Object.keys(zip.files)) {
      if (!name.startsWith('word/') || !name.endsWith('.xml') || name.includes('_rels')) {
        continue;
      }
      if (seen.has(name)) continue;
      const entry = zip.file(name);
      if (!entry) continue;
      const xml = await entry.async('string');
      if (!(xml.includes('<w:t') || xml.includes(':t'))) continue;
      const text = xmlToParagraphs(xml);
      if (text.trim()) chunks.push(text);
    }
  }

  return chunks.join('\n\n').trim();
}

function xmlToParagraphs(xml: string): string {
  const paragraphs: string[] = [];
  const paraRegex = /<(?:[\w.]+:)?p\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?p>/g;
  let paraMatch: RegExpExecArray | null;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const runRegex = /<(?:[\w.]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.]+:)?t>/g;
    const runs: string[] = [];
    let runMatch: RegExpExecArray | null;
    while ((runMatch = runRegex.exec(paraMatch[1])) !== null) {
      runs.push(decodeXmlEntities(runMatch[1]));
    }
    if (runs.length > 0) paragraphs.push(runs.join(''));
  }

  if (paragraphs.length === 0) {
    return decodeXmlEntities(xml.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
  }
  return paragraphs.join('\n\n');
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return '';
      }
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

type SanitizedBrief = {
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
  confidence: { overall: number; notes: string };
};

function sanitizeExtracted(raw: unknown): SanitizedBrief {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const durationUnit = normalizeDurationUnit(obj.durationUnit);
  let targetAmountNaira = asFiniteNumber(obj.targetAmountNaira);
  let totalUnits = asPositiveInt(obj.totalUnits);
  let unitPriceNaira = asFiniteNumber(obj.unitPriceNaira);

  // Derive missing unit economics when two of three are present.
  if (
    targetAmountNaira != null &&
    totalUnits != null &&
    totalUnits > 0 &&
    unitPriceNaira == null
  ) {
    unitPriceNaira = targetAmountNaira / totalUnits;
  } else if (
    targetAmountNaira != null &&
    unitPriceNaira != null &&
    unitPriceNaira > 0 &&
    totalUnits == null
  ) {
    const derived = Math.round(targetAmountNaira / unitPriceNaira);
    if (derived > 0) totalUnits = derived;
  } else if (
    totalUnits != null &&
    totalUnits > 0 &&
    unitPriceNaira != null &&
    targetAmountNaira == null
  ) {
    targetAmountNaira = totalUnits * unitPriceNaira;
  }

  // Reject absurd targets (likely kobo mistaken for naira, or garbage).
  if (targetAmountNaira != null && (targetAmountNaira <= 0 || targetAmountNaira > 1e14)) {
    targetAmountNaira = null;
  }

  const confidenceObj =
    obj.confidence && typeof obj.confidence === 'object'
      ? (obj.confidence as Record<string, unknown>)
      : {};
  let overall = asFiniteNumber(confidenceObj.overall);
  if (overall == null) overall = 0;
  if (overall > 1 && overall <= 100) overall = overall / 100;
  overall = Math.min(1, Math.max(0, overall));

  return {
    name: asNonEmptyString(obj.name),
    sector: asNonEmptyString(obj.sector),
    location: asNonEmptyString(obj.location),
    summary: asNonEmptyString(obj.summary),
    fullDetails: asNonEmptyString(obj.fullDetails),
    risks: asNonEmptyString(obj.risks),
    timeline: asNonEmptyString(obj.timeline),
    targetAmountNaira,
    totalUnits,
    unitPriceNaira,
    durationValue: asPositiveInt(obj.durationValue),
    durationUnit,
    estimatedRoiPct: normalizePercent(obj.estimatedRoiPct),
    profitSplitInvestorPct: normalizePercent(obj.profitSplitInvestorPct),
    exitNoticeDays: asPositiveInt(obj.exitNoticeDays),
    earlyExitPenaltyPct: normalizePercent(obj.earlyExitPenaltyPct),
    minUnitsPerInvestor: asPositiveInt(obj.minUnitsPerInvestor),
    confidence: {
      overall,
      notes: asNonEmptyString(confidenceObj.notes) ?? '',
    },
  };
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === 'null' || t.toLowerCase() === 'undefined') {
    return null;
  }
  return t;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[₦$,\s]/g, '').replace(/million|m$/i, 'e6').replace(/billion|b$/i, 'e9');
    // Simple "250e6" / plain number only — avoid eval.
    const m = cleaned.match(/^(-?\d+(?:\.\d+)?)(?:e(\d+))?$/i);
    if (!m) {
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    const base = Number(m[1]);
    const exp = m[2] ? Number(m[2]) : 0;
    const n = base * 10 ** exp;
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asPositiveInt(v: unknown): number | null {
  const n = asFiniteNumber(v);
  if (n == null || n <= 0) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

/** Accept 0–100 percent; convert accidental 0–1 fractions. */
function normalizePercent(v: unknown): number | null {
  const n = asFiniteNumber(v);
  if (n == null) return null;
  if (n < 0) return null;
  if (n > 0 && n <= 1) return Math.round(n * 10000) / 100; // 0.2 → 20
  if (n > 100) return null;
  return n;
}

function normalizeDurationUnit(
  v: unknown,
): 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS' | null {
  if (typeof v !== 'string') return null;
  const u = v.trim().toUpperCase();
  if (u === 'DAY') return 'DAYS';
  if (u === 'WEEK') return 'WEEKS';
  if (u === 'MONTH') return 'MONTHS';
  if (u === 'YEAR') return 'YEARS';
  if (u === 'DAYS' || u === 'WEEKS' || u === 'MONTHS' || u === 'YEARS') return u;
  return null;
}
