// -----------------------------------------------------------------------------
// extract-project-brief — Gemini 3.1 Pro structured extraction
//
// Deploy target: Supabase Edge Function
//
// Called by the Create Project wizard once the LM uploads a single project
// brief (PDF / DOCX / TXT). The function:
//   1. Downloads the private file from the `project-documents` bucket.
//   2. Uploads it inline to Gemini 3.1 Pro with a strict JSON schema.
//   3. Returns the parsed JSON payload back to the client so the wizard
//      can pre-fill its form fields.
//
// Secrets (set via `supabase secrets set --env-file .env`):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY   (needs `storage.objects` read on private bucket)
//   - EMERGENT_LLM_KEY            (works with Gemini generativelanguage.googleapis.com
//                                 via the x-goog-api-key header — same as a Google
//                                 AI Studio key). Falls back to GEMINI_API_KEY.
//
// Auth: caller must be a Line Manager, CEO, or ADMIN. The check runs against
// their JWT via `createUserClient(req)`.
// -----------------------------------------------------------------------------
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import {
  createServiceClient,
  createUserClient,
  requireUser,
} from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import JSZip from 'npm:jszip@3.10.1';

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Strict JSON schema — Gemini's `responseSchema` uses an OpenAPI 3.0 subset
// (proto: google.ai.generativelanguage.v1beta.Schema), so:
//   * `type` is a single UPPERCASE scalar ('STRING' / 'INTEGER' / 'NUMBER' /
//     'OBJECT' / 'ARRAY' / 'BOOLEAN'), never an array-union.
//   * Nullability is expressed via `nullable: true`, not `type: [..., 'null']`.
//   * `additionalProperties` is not a recognised field and must be omitted.
// Anything the model can't confidently extract must be `null`. Never guess.
const briefSchema = {
  type: 'OBJECT',
  properties: {
    name:                   { type: 'STRING',  nullable: true },
    sector:                 { type: 'STRING',  nullable: true },
    location:               { type: 'STRING',  nullable: true },
    summary:                { type: 'STRING',  nullable: true },
    fullDetails:            { type: 'STRING',  nullable: true },
    risks:                  { type: 'STRING',  nullable: true },
    timeline:               { type: 'STRING',  nullable: true },
    targetAmountNaira:      { type: 'NUMBER',  nullable: true },
    totalUnits:             { type: 'INTEGER', nullable: true },
    unitPriceNaira:         { type: 'NUMBER',  nullable: true },
    durationValue:          { type: 'INTEGER', nullable: true },
    durationUnit: {
      type: 'STRING',
      nullable: true,
      enum: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'],
    },
    estimatedRoiPct:        { type: 'NUMBER',  nullable: true },
    profitSplitInvestorPct: { type: 'NUMBER',  nullable: true },
    exitNoticeDays:         { type: 'INTEGER', nullable: true },
    earlyExitPenaltyPct:    { type: 'NUMBER',  nullable: true },
    minUnitsPerInvestor:    { type: 'INTEGER', nullable: true },
    confidence: {
      type: 'OBJECT',
      properties: {
        overall: { type: 'NUMBER' },
        notes:   { type: 'STRING' },
      },
      required: ['overall', 'notes'],
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
- targetAmountNaira:       Total raise in Nigerian Naira (₦). Not kobo.
- totalUnits:              Number of units the raise is broken into.
- unitPriceNaira:          Naira per unit. Derive if targetAmount and totalUnits
                           are both present.
- durationValue + durationUnit: Investment tenor (e.g. 12 MONTHS).
- estimatedRoiPct:         Investor gross ROI over the tenor, as a percentage
                           (e.g. 20 means 20%). NOT a decimal.
- profitSplitInvestorPct:  Investor share of the distributable pool as a percent
                           (e.g. 70 means investors get 70%, manager 30%).
- exitNoticeDays:          Notice period for early exit, in days.
- earlyExitPenaltyPct:     Penalty for exiting early, as a percentage.
- minUnitsPerInvestor:     Minimum units a single investor must subscribe.
- confidence:              overall = 0..1 confidence; notes = short human-readable
                           reason for any unfilled fields.

Return ONLY the JSON — no prose, no markdown fences.`;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // ---- 1. Auth ------------------------------------------------------------
    const userClient = createUserClient(req);
    const user = await requireUser(userClient);
    const role = await getUserRole(userClient, user.id);
    assertRole(
      role,
      ['LINE_MANAGER', 'CEO', 'ADMIN'],
      'Only Line Managers, CEO, or admins can extract project briefs.',
    );

    // ---- 2. Parse input -----------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const bucket: string = body.bucket ?? 'project-documents';
    const path: string | undefined = body.path;
    const mimeType: string = body.mimeType ?? 'application/pdf';
    if (!path) throw new HttpError(400, 'Missing `path` in request body.');

    // ---- 3. Download the file -----------------------------------------------
    const service = createServiceClient();
    const { data: file, error: dlError } = await service.storage
      .from(bucket)
      .download(path);
    if (dlError || !file) {
      throw new HttpError(404, `Failed to download file: ${dlError?.message ?? 'unknown error'}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());

    // Basic size guard — Gemini inline supports 20MB per part safely.
    if (bytes.length > 20 * 1024 * 1024) {
      throw new HttpError(
        413,
        'Project brief is larger than 20MB. Please compress the file or split it before uploading.',
      );
    }

    // ---- 3b. Normalise input for Gemini -------------------------------------
    // Gemini's inline API accepts PDFs & images natively but NOT DOCX. For
    // DOCX/TXT we extract the raw text and send it as a text part instead of
    // an `inlineData` blob. Kind is decided from mimeType first, then from
    // the file extension as a fallback for browsers that mis-report DOCX as
    // `application/octet-stream`.
    const lowerPath = path.toLowerCase();
    const isDocx =
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      lowerPath.endsWith('.docx');
    const isTxt =
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      lowerPath.endsWith('.txt') ||
      lowerPath.endsWith('.md');
    const isPdf =
      mimeType === 'application/pdf' || lowerPath.endsWith('.pdf');

    let userParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >;

    if (isPdf) {
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
        `Unsupported brief format (${mimeType}). Please upload a PDF, DOCX or TXT file.`,
      );
    }

    // ---- 4. Call Gemini -----------------------------------------------------
    const apiKey =
      Deno.env.get('EMERGENT_LLM_KEY') ?? Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new HttpError(
        500,
        'Missing EMERGENT_LLM_KEY (or GEMINI_API_KEY) edge-function secret.',
      );
    }

    const geminiRes = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: userParts,
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: briefSchema,
          temperature: 0,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini error', geminiRes.status, errBody);
      throw new HttpError(
        502,
        `Gemini extraction failed (${geminiRes.status}). Please retry, or fill the form manually.`,
      );
    }

    const geminiJson = await geminiRes.json();
    const rawText: string =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON', parseErr, rawText);
      throw new HttpError(
        502,
        'The extractor returned malformed JSON. Please try again with a cleaner document.',
      );
    }

    return jsonResponse({ ok: true, extracted, model: GEMINI_MODEL });
  } catch (err) {
    return errorResponse(err);
  }
});

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.slice(i, i + chunk));
  }
  return btoa(bin);
}

// ---------------------------------------------------------------------------
// DOCX text extraction
//
// A .docx is a ZIP. The prose lives in `word/document.xml`, wrapped in
// `<w:p>` (paragraph) / `<w:t>` (text run) tags. We use JSZip (pure JS, works
// on Deno Deploy) to unzip, then regex the text out of the WordprocessingML.
// Headings, tables and bullets flatten to plain paragraphs — good enough for
// Gemini's structured extraction (it doesn't need visual layout).
// ---------------------------------------------------------------------------

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

  const doc = zip.file('word/document.xml');
  if (!doc) {
    throw new HttpError(400, 'Invalid DOCX: word/document.xml is missing.');
  }
  const xml = await doc.async('string');

  const paragraphs: string[] = [];
  // Split by <w:p> boundaries and pull text runs out of each. Preserving
  // paragraph breaks helps the model separate "risks" bullets from
  // "timeline" bullets, etc.
  const paraRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let paraMatch: RegExpExecArray | null;
  while ((paraMatch = paraRegex.exec(xml)) !== null) {
    const runRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    const runs: string[] = [];
    let runMatch: RegExpExecArray | null;
    while ((runMatch = runRegex.exec(paraMatch[1])) !== null) {
      runs.push(decodeXmlEntities(runMatch[1]));
    }
    if (runs.length > 0) paragraphs.push(runs.join(''));
  }
  return paragraphs.join('\n\n');
}

function decodeXmlEntities(input: string): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}
