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

const GEMINI_MODEL = 'gemini-3.1-pro-preview';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Strict JSON schema — mirrors the fields the Prism Create Project wizard
// asks for. Anything the model can't confidently extract must be `null`
// (scalars) or `""` (strings). Never guess.
const briefSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: ['string', 'null'] },
    sector: { type: ['string', 'null'] },
    location: { type: ['string', 'null'] },
    summary: { type: ['string', 'null'] },
    fullDetails: { type: ['string', 'null'] },
    risks: { type: ['string', 'null'] },
    timeline: { type: ['string', 'null'] },
    targetAmountNaira: { type: ['number', 'null'] },
    totalUnits: { type: ['integer', 'null'] },
    unitPriceNaira: { type: ['number', 'null'] },
    durationValue: { type: ['integer', 'null'] },
    durationUnit: {
      type: ['string', 'null'],
      enum: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS', null],
    },
    estimatedRoiPct: { type: ['number', 'null'] },
    profitSplitInvestorPct: { type: ['number', 'null'] },
    exitNoticeDays: { type: ['integer', 'null'] },
    earlyExitPenaltyPct: { type: ['number', 'null'] },
    minUnitsPerInvestor: { type: ['integer', 'null'] },
    confidence: {
      type: 'object',
      additionalProperties: false,
      properties: {
        overall: { type: 'number' },
        notes: { type: 'string' },
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
    const b64 = toBase64(bytes);

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
            parts: [
              {
                text: 'Extract the project brief fields from the attached document.',
              },
              { inlineData: { mimeType, data: b64 } },
            ],
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
