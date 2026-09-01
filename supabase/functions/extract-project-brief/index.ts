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
    durationUnit: {
      type: 'STRING',
      nullable: true,
      enum: ['DAYS', 'WEEKS', 'MONTHS', 'YEARS'],
    },
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
    if (!path) throw new HttpError(400, 'Missing `path` in request body.');

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
      mimeType === 'application/msword' || lowerPath.endsWith('.doc');
    const isTxt =
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      lowerPath.endsWith('.txt') ||
      lowerPath.endsWith('.md');
    const isPdf = mimeType === 'application/pdf' || lowerPath.endsWith('.pdf');

    if (isLegacyDoc && !isDocx) {
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

    const candidate = geminiJson?.candidates?.[0];
    const finishReason = candidate?.finishReason as string | undefined;
    if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
      throw new HttpError(
        502,
        `Gemini stopped extraction (${finishReason}). Try a cleaner PDF/DOCX, or fill the form manually.`,
      );
    }

    const rawText: string =
      candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ??
      '';

    if (!rawText.trim()) {
      const block =
        geminiJson?.promptFeedback?.blockReason ??
        geminiJson?.error?.message ??
        'empty response';
      throw new HttpError(
        502,
        `Gemini returned no extraction payload (${block}). Please retry or fill the form manually.`,
      );
    }

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(stripMarkdownFences(rawText));
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON', parseErr, rawText.slice(0, 500));
      throw new HttpError(
        502,
        'The extractor returned malformed JSON. Please try again with a cleaner document.',
      );
    }

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

      const geminiRes = await fetch(endpoint, {
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
      });

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

  // Prefer main document; fall back to any word/*.xml with body text.
  const candidates = [
    'word/document.xml',
    ...Object.keys(zip.files).filter(
      (n) => n.startsWith('word/') && n.endsWith('.xml') && !n.includes('_rels'),
    ),
  ];

  let xml = '';
  for (const name of candidates) {
    const entry = zip.file(name);
    if (!entry) continue;
    xml = await entry.async('string');
    if (xml.includes('<w:t') || xml.includes(':t ')) break;
  }

  if (!xml) {
    throw new HttpError(400, 'Invalid DOCX: word/document.xml is missing.');
  }

  const paragraphs: string[] = [];
  // Match namespaced and unprefixed paragraph / text-run tags.
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

  // Last-resort: strip tags if paragraph walk found nothing (odd OOXML).
  if (paragraphs.length === 0) {
    const stripped = decodeXmlEntities(xml.replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    return stripped;
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
