// notify-investors — FULLY INLINED (no _shared imports)
// Paste this whole file into Supabase Dashboard → Edge Functions → notify-investors → index.ts
//
// Required Supabase Secrets (Project Settings → Edge Functions → Secrets):
//   SUPABASE_URL                (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   RESEND_API_KEY              <-- your Resend API key
//   SENDER_EMAIL                <-- e.g. "Prism Capital <noreply@yourdomain.com>"
//   APP_URL                     <-- e.g. https://your-app.preview.emergentagent.com
//   NOTIFY_WEBHOOK_SECRET       <-- random string; must match app.notify_secret in Postgres
//
// Called by Postgres triggers via pg_net whenever:
//   - a row is inserted into public.project_updates
//   - a profit_declarations row transitions PENDING -> APPROVED
//
// Auth: the caller sends `x-webhook-secret` == NOTIFY_WEBHOOK_SECRET.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// -------------------- CORS --------------------
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// -------------------- Errors --------------------
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ error: error.message }, error.status);
  }
  console.error(error);
  return jsonResponse({ error: 'Internal server error' }, 500);
}

// -------------------- Supabase client --------------------
function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role environment variables');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// -------------------- Resend --------------------
type ResendSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

async function sendEmailViaResend(input: ResendSendInput): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const sender = Deno.env.get('SENDER_EMAIL') ?? 'onboarding@resend.dev';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured on this Supabase project.');
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: sender,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${body.slice(0, 400)}`);
  }
}

function escapeHtml(input: string): string {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// -------------------- Email templates --------------------

const UPDATE_KIND_LABELS: Record<string, string> = {
  RISK: 'Risk update',
  FUND_USE: 'Fund use',
  ENGAGEMENT: 'Engagement',
  MILESTONE: 'Milestone',
  ANNOUNCEMENT: 'Announcement',
};

function renderProjectUpdateEmail(params: {
  projectName: string;
  managerName: string;
  updateKind: string;
  updateTitle: string;
  updateBody: string;
  amountNaira?: number | null;
  projectUrl: string;
}): { html: string; text: string; subject: string } {
  const {
    projectName,
    managerName,
    updateKind,
    updateTitle,
    updateBody,
    amountNaira,
    projectUrl,
  } = params;
  const kindLabel = UPDATE_KIND_LABELS[updateKind] ?? updateKind;
  const subject = `${kindLabel}: ${updateTitle} · ${projectName}`;
  const amountLine =
    amountNaira && amountNaira > 0
      ? `<p style="margin:8px 0 0 0;color:#4E5A52;font-size:13px;">Amount: <strong style="color:#0F1512;">₦${amountNaira.toLocaleString()}</strong></p>`
      : '';
  const bodyBlock = updateBody
    ? `<p style="margin:14px 0 0 0;color:#0F1512;font-size:14px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(updateBody)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
        <tr><td style="height:4px;background:#166534;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 6px 32px;">
          <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
          <div style="font-size:12px;color:#4E5A52;margin-top:2px;">Project update · ${escapeHtml(projectName)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 4px 32px;">
          <span style="display:inline-block;background:#EEF7F0;color:#166534;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;">${escapeHtml(kindLabel)}</span>
          <h1 style="margin:12px 0 4px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#0F1512;font-weight:600;letter-spacing:-0.3px;">${escapeHtml(updateTitle)}</h1>
          <p style="margin:0;color:#4E5A52;font-size:13px;">Posted by <strong style="color:#0F1512;">${escapeHtml(managerName)}</strong></p>
          ${amountLine}${bodyBlock}
        </td></tr>
        <tr><td style="padding:22px 32px 10px 32px;">
          <a href="${projectUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;font-size:14px;">Open project →</a>
        </td></tr>
        <tr><td style="padding:14px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
          <p style="margin:0;color:#4E5A52;font-size:11px;line-height:1.6;">You are receiving this because you hold a confirmed position in <strong style="color:#0F1512;">${escapeHtml(projectName)}</strong> on Prism Capital.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const amountTextLine =
    amountNaira && amountNaira > 0 ? `Amount: NGN ${amountNaira.toLocaleString()}\n` : '';

  const text = `PRISM CAPITAL — ${projectName}
${kindLabel}: ${updateTitle}
Posted by ${managerName}
${amountTextLine}
${updateBody}

Open project: ${projectUrl}
`;

  return { subject, html, text };
}

function renderDeclarationApprovedEmail(params: {
  projectName: string;
  label: string;
  isFinal: boolean;
  perUnitNaira: number;
  investorPoolNaira: number;
  totalUnits: number;
  investorUnits: number | null;
  reference: string | null;
  projectUrl: string;
}): { html: string; text: string; subject: string } {
  const {
    projectName,
    label,
    isFinal,
    perUnitNaira,
    investorPoolNaira,
    totalUnits,
    investorUnits,
    reference,
    projectUrl,
  } = params;

  const badge = isFinal ? 'Final distribution' : 'Interim distribution';
  const subject = `${badge}: ${label} · ${projectName}`;

  const yourShareMinor =
    investorUnits && investorUnits > 0 ? perUnitNaira * investorUnits : 0;
  const investorPayoutLine =
    investorUnits && investorUnits > 0
      ? `<p style="margin:8px 0 0 0;color:#4E5A52;font-size:13px;">Your estimated share: <strong style="color:#0F1512;">₦${yourShareMinor.toLocaleString()}</strong> (${investorUnits.toLocaleString()} unit${investorUnits === 1 ? '' : 's'})</p>`
      : '';

  const refLine = reference
    ? `<p style="margin:0;color:#4E5A52;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;">Ref · ${escapeHtml(reference)}</p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
        <tr><td style="height:4px;background:#B08D2E;line-height:4px;">&nbsp;</td></tr>
        <tr><td style="padding:28px 32px 6px 32px;">
          <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
          <div style="font-size:12px;color:#4E5A52;margin-top:2px;">Distribution approved · ${escapeHtml(projectName)}</div>
        </td></tr>
        <tr><td style="padding:16px 32px 4px 32px;">
          <span style="display:inline-block;background:#FEF9E9;color:#7A5300;font-size:11px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;padding:4px 10px;border-radius:999px;border:1px solid #EED28A;">${escapeHtml(badge)}</span>
          <h1 style="margin:12px 0 4px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#0F1512;font-weight:600;letter-spacing:-0.3px;">${escapeHtml(label)}</h1>
          ${refLine}
        </td></tr>
        <tr><td style="padding:16px 32px 8px 32px;">
          <div style="border:1px solid #D5DED8;border-radius:12px;padding:16px 18px;background:#F9FAF7;">
            <p style="margin:0;color:#4E5A52;font-size:11px;letter-spacing:0.8px;font-weight:600;text-transform:uppercase;">Per-unit payout</p>
            <p style="margin:4px 0 12px 0;color:#0F1512;font-size:22px;font-weight:700;">₦${perUnitNaira.toLocaleString()}</p>
            <p style="margin:0;color:#4E5A52;font-size:12px;">Investor pool: <strong style="color:#0F1512;">₦${investorPoolNaira.toLocaleString()}</strong> · Across ${totalUnits.toLocaleString()} unit${totalUnits === 1 ? '' : 's'}</p>
            ${investorPayoutLine}
          </div>
        </td></tr>
        <tr><td style="padding:20px 32px 10px 32px;">
          <a href="${projectUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px;font-size:14px;">View statement →</a>
          <p style="margin:12px 0 0 0;color:#4E5A52;font-size:12px;line-height:1.6;">This distribution has passed the four-eyes checker review and been posted to the ledger.</p>
        </td></tr>
        <tr><td style="padding:14px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
          <p style="margin:0;color:#4E5A52;font-size:11px;line-height:1.6;">You are receiving this because you hold a confirmed position in <strong style="color:#0F1512;">${escapeHtml(projectName)}</strong> on Prism Capital.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const refTextLine = reference ? `Ref: ${reference}\n` : '';
  const shareTextLine =
    investorUnits && investorUnits > 0
      ? `Your estimated share: NGN ${yourShareMinor.toLocaleString()} (${investorUnits} unit${investorUnits === 1 ? '' : 's'})\n`
      : '';

  const text = `PRISM CAPITAL — ${projectName}
${badge}: ${label}
${refTextLine}Per-unit payout: NGN ${perUnitNaira.toLocaleString()}
Investor pool: NGN ${investorPoolNaira.toLocaleString()} across ${totalUnits.toLocaleString()} units
${shareTextLine}
View statement: ${projectUrl}
`;

  return { subject, html, text };
}

// -------------------- Handler --------------------

type NotifyType = 'PROJECT_UPDATE' | 'DECLARATION_APPROVED';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // 1. Verify webhook secret
    const expected = Deno.env.get('NOTIFY_WEBHOOK_SECRET');
    if (!expected) {
      throw new HttpError(500, 'NOTIFY_WEBHOOK_SECRET not configured');
    }
    const provided = req.headers.get('x-webhook-secret');
    if (provided !== expected) {
      throw new HttpError(401, 'Invalid webhook secret');
    }

    // 2. Parse payload
    const body = await req.json();
    const type = String(body.type ?? '') as NotifyType;
    const recordId = String(body.recordId ?? '');
    if (!type || !recordId) {
      throw new HttpError(400, 'type and recordId are required');
    }

    const admin = createServiceClient();
    const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '');
    if (!appUrl) throw new HttpError(500, 'APP_URL not configured');

    // 3. Dispatch
    if (type === 'PROJECT_UPDATE') {
      return jsonResponse(await handleProjectUpdate(admin, recordId, appUrl));
    }
    if (type === 'DECLARATION_APPROVED') {
      return jsonResponse(await handleDeclarationApproved(admin, recordId, appUrl));
    }
    throw new HttpError(400, `Unknown notification type: ${type}`);
  } catch (error) {
    return errorResponse(error);
  }
});

async function handleProjectUpdate(
  admin: SupabaseClient,
  updateId: string,
  appUrl: string,
) {
  const { data: update, error: updateErr } = await admin
    .from('project_updates')
    .select(
      'id, project_id, kind, title, body, amount_minor, posted_by, projects:project_id(name), poster:posted_by(full_name)',
    )
    .eq('id', updateId)
    .single();
  if (updateErr || !update) {
    throw new HttpError(
      404,
      `project_update not found: ${updateErr?.message ?? updateId}`,
    );
  }

  // deno-lint-ignore no-explicit-any
  const u: any = update;
  const projectName: string = u.projects?.name ?? 'Your project';
  const managerName: string = u.poster?.full_name ?? 'The project manager';
  const projectUrl = `${appUrl}/projects/${u.project_id}`;
  const amountNaira = u.amount_minor ? Math.round(Number(u.amount_minor) / 100) : null;

  const investors = await listConfirmedInvestorEmails(admin, u.project_id);
  const { subject, html, text } = renderProjectUpdateEmail({
    projectName,
    managerName,
    updateKind: u.kind,
    updateTitle: u.title,
    updateBody: u.body ?? '',
    amountNaira,
    projectUrl,
  });

  return await sendToRecipients(investors, subject, html, text);
}

async function handleDeclarationApproved(
  admin: SupabaseClient,
  declId: string,
  appUrl: string,
) {
  const { data: decl, error: declErr } = await admin
    .from('profit_declarations')
    .select(
      'id, project_id, reference, label, is_final, per_unit_minor, investor_pool_minor, total_units_at_declaration, projects:project_id(name)',
    )
    .eq('id', declId)
    .single();
  if (declErr || !decl) {
    throw new HttpError(
      404,
      `profit_declaration not found: ${declErr?.message ?? declId}`,
    );
  }

  // deno-lint-ignore no-explicit-any
  const d: any = decl;
  const projectName: string = d.projects?.name ?? 'Your project';
  const projectUrl = `${appUrl}/projects/${d.project_id}`;
  const perUnitNaira = Math.round(Number(d.per_unit_minor ?? 0) / 100);
  const investorPoolNaira = Math.round(Number(d.investor_pool_minor ?? 0) / 100);

  const { data: rows, error: invErr } = await admin
    .from('invites')
    .select('email, units_allotted, units_pledged, profiles:investor_id(email)')
    .eq('project_id', d.project_id)
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
      label: d.label ?? (d.is_final ? 'Final distribution' : 'Interim distribution'),
      isFinal: !!d.is_final,
      perUnitNaira,
      investorPoolNaira,
      totalUnits: d.total_units_at_declaration ?? 0,
      investorUnits: units,
      reference: d.reference ?? null,
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

async function listConfirmedInvestorEmails(
  admin: SupabaseClient,
  projectId: string,
): Promise<string[]> {
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
