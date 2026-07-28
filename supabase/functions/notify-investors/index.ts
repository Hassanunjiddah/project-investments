// Edge function invoked by Postgres triggers (via pg_net) whenever a project
// posts an update or a profit declaration is approved. Fans out one email
// per confirmed investor via Resend.
//
// Auth model: the trigger includes an `x-webhook-secret` header matching the
// NOTIFY_WEBHOOK_SECRET env var on this Supabase project. All DB reads use
// the service role client (bypasses RLS) because the caller is Postgres, not
// a signed-in user.
//
// Payload shapes:
//   { "type": "PROJECT_UPDATE",       "recordId": "<uuid>" }
//   { "type": "DECLARATION_APPROVED", "recordId": "<uuid>" }
//
// Idempotency: we don't retry within the function. Duplicate trigger fires
// would send duplicate emails — this is acceptable for the current volume.

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabaseClient.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import {
  sendEmailViaResend,
  renderProjectUpdateEmail,
  renderDeclarationApprovedEmail,
} from '../_shared/email.ts';

type NotifyType = 'PROJECT_UPDATE' | 'DECLARATION_APPROVED';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // -- 1. Verify webhook secret --------------------------------------------
    const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
    if (!expected) {
      throw new HttpError(500, 'NOTIFY_WEBHOOK_SECRET not configured');
    }
    const provided = req.headers.get('x-webhook-secret');
    if (provided !== expected) {
      throw new HttpError(401, 'Invalid webhook secret');
    }

    // -- 2. Parse & validate payload -----------------------------------------
    const body = await req.json();
    const type = String(body.type ?? '') as NotifyType;
    const recordId = String(body.recordId ?? '');
    if (!type || !recordId) {
      throw new HttpError(400, 'type and recordId are required');
    }

    const admin = createServiceClient();
    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
    if (!appUrl) throw new HttpError(500, 'APP_URL not configured');

    // -- 3. Dispatch ---------------------------------------------------------
    if (type === 'PROJECT_UPDATE') {
      const result = await handleProjectUpdate(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    if (type === 'DECLARATION_APPROVED') {
      const result = await handleDeclarationApproved(admin, recordId, appUrl);
      return jsonResponse(result);
    }
    throw new HttpError(400, `Unknown notification type: ${type}`);
  } catch (error) {
    return errorResponse(error);
  }
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function handleProjectUpdate(admin: any, updateId: string, appUrl: string) {
  const { data: update, error: updateErr } = await admin
    .from('project_updates')
    .select(
      'id, project_id, kind, title, body, amount_minor, posted_by, projects:project_id(name), poster:posted_by(full_name)',
    )
    .eq('id', updateId)
    .single();
  if (updateErr || !update) {
    throw new HttpError(404, `project_update not found: ${updateErr?.message ?? updateId}`);
  }

  const projectName = update.projects?.name ?? 'Your project';
  const managerName = update.poster?.full_name ?? 'The project manager';
  const projectUrl = `${appUrl}/projects/${update.project_id}`;
  const amountNaira = update.amount_minor ? Math.round(update.amount_minor / 100) : null;

  const investors = await listConfirmedInvestorEmails(admin, update.project_id);
  const { subject, html, text } = renderProjectUpdateEmail({
    projectName,
    managerName,
    updateKind: update.kind,
    updateTitle: update.title,
    updateBody: update.body ?? '',
    amountNaira,
    projectUrl,
  });

  return await sendToRecipients(investors, subject, html, text);
}

// deno-lint-ignore no-explicit-any
async function handleDeclarationApproved(admin: any, declId: string, appUrl: string) {
  const { data: decl, error: declErr } = await admin
    .from('profit_declarations')
    .select(
      'id, project_id, reference, label, is_final, per_unit_minor, investor_pool_minor, total_units_at_declaration, projects:project_id(name)',
    )
    .eq('id', declId)
    .single();
  if (declErr || !decl) {
    throw new HttpError(404, `profit_declaration not found: ${declErr?.message ?? declId}`);
  }

  const projectName = decl.projects?.name ?? 'Your project';
  const projectUrl = `${appUrl}/projects/${decl.project_id}`;
  const perUnitNaira = Math.round(Number(decl.per_unit_minor ?? 0) / 100);
  const investorPoolNaira = Math.round(Number(decl.investor_pool_minor ?? 0) / 100);

  // Fetch confirmed investors together with their unit counts, so each email
  // can show a personalised "your share" line.
  const { data: rows, error: invErr } = await admin
    .from('invites')
    .select('email, units_allotted, units_pledged, profiles:investor_id(email)')
    .eq('project_id', decl.project_id)
    .eq('status', 'CONFIRMED');
  if (invErr) throw new HttpError(500, invErr.message);

  const results: Array<{ email: string; ok: boolean; error?: string }> = [];
  for (const row of rows ?? []) {
    // deno-lint-ignore no-explicit-any
    const r: any = row;
    const email: string | null = r.profiles?.email ?? r.email ?? null;
    if (!email) continue;
    const units: number | null =
      typeof r.units_allotted === 'number'
        ? r.units_allotted
        : typeof r.units_pledged === 'number'
          ? r.units_pledged
          : null;

    const { subject, html, text } = renderDeclarationApprovedEmail({
      projectName,
      label: decl.label ?? (decl.is_final ? 'Final distribution' : 'Interim distribution'),
      isFinal: !!decl.is_final,
      perUnitNaira,
      investorPoolNaira,
      totalUnits: decl.total_units_at_declaration ?? 0,
      investorUnits: units,
      reference: decl.reference ?? null,
      projectUrl,
    });
    try {
      await sendEmailViaResend({ to: email, subject, html, text });
      results.push({ email, ok: true });
    } catch (err) {
      results.push({
        email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    type: 'DECLARATION_APPROVED',
    declarationId: declId,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function listConfirmedInvestorEmails(admin: any, projectId: string): Promise<string[]> {
  const { data, error } = await admin
    .from('invites')
    .select('email, profiles:investor_id(email)')
    .eq('project_id', projectId)
    .eq('status', 'CONFIRMED');
  if (error) throw new HttpError(500, error.message);
  const emails = new Set<string>();
  for (const row of data ?? []) {
    // deno-lint-ignore no-explicit-any
    const r: any = row;
    const email: string | null = r.profiles?.email ?? r.email ?? null;
    if (email) emails.add(email.toLowerCase());
  }
  return [...emails];
}

async function sendToRecipients(
  emails: string[],
  subject: string,
  html: string,
  text: string,
) {
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];
  for (const email of emails) {
    try {
      await sendEmailViaResend({ to: email, subject, html, text });
      results.push({ email, ok: true });
    } catch (err) {
      results.push({
        email,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return {
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
