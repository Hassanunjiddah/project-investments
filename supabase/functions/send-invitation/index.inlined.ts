// send-invitation — FULLY INLINED (no _shared imports)
// Paste this whole file into Supabase Dashboard → Edge Functions → send-invitation → index.ts
//
// Kept in sync with ./index.ts + _shared helpers (cors, errors, supabaseClient,
// auth, password, email). If you edit index.ts, regenerate this file.
//
// Required Supabase Secrets (Project Settings → Edge Functions → Secrets):
//   SUPABASE_URL                (auto-provided)
//   SUPABASE_ANON_KEY           (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   RESEND_API_KEY              (Resend transactional email)
//   SENDER_EMAIL                (verified sender)
//   APP_URL                     (deploy origin for the sign-in link)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ---------- CORS ----------
const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// ---------- Errors ----------
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

// ---------- Supabase clients ----------
function createUserClient(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) throw new Error('Missing Supabase environment variables');
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Missing Authorization header');
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('Missing Supabase service role environment variables');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

// ---------- Auth helpers ----------
type UserRole = 'CEO' | 'ADMIN' | 'LINE_MANAGER' | 'INVESTOR' | 'PROJECT_OWNER';

async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error || !data?.role) {
    throw new HttpError(403, 'Profile not found');
  }
  return data.role as UserRole;
}

function assertRole(role: UserRole, allowed: UserRole[], message: string) {
  if (!allowed.includes(role)) {
    throw new HttpError(403, message);
  }
}

// ---------- Validation ----------
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- Email (Resend) ----------
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
    // Fail loud so the edge function returns 500 (rather than pretending it sent)
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

// Build the invitation HTML — Prism Capital branded, print-safe layout.
function renderInviteEmail(params: {
  projectName: string;
  managerName: string;
  code: string;
  signInUrl: string;
  minUnits?: number | null;
}): { html: string; text: string; subject: string } {
  const { projectName, managerName, code, signInUrl, minUnits } = params;
  const capLine = minUnits
    ? `<p style="margin:16px 0 0 0;color:#4E5A52;font-size:14px;line-height:1.6;">Minimum subscription: <strong style="color:#0F1512;">${minUnits.toLocaleString()} unit${minUnits === 1 ? '' : 's'}</strong> on this project.</p>`
    : '';

  const subject = `Invitation to invest in ${projectName} · Prism Capital`;

  // Design tokens (kept in sync with src/constants/colors.ts light palette).
  //   BRAND_700 #166534 · INK_TEXT #0F1512 · INK_MUTED #4E5A52
  //   INK_LINE #D5DED8 · INK_FAINT #F1F4EF · GOLD_500 #B08D2E · BRAND_50 #EEF7F0

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F1F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F1512;">
  <!-- Preheader (hidden) -->
  <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">${escapeHtml(managerName)} has invited you to invest in ${escapeHtml(projectName)}. Your 8-character code is ${escapeHtml(code)}.</div>

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#F1F4EF;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:16px;border:1px solid #D5DED8;overflow:hidden;">
          <!-- Top green rule -->
          <tr><td style="height:4px;background:#166534;line-height:4px;">&nbsp;</td></tr>

          <!-- Header band -->
          <tr>
            <td style="padding:28px 32px 6px 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <span style="display:inline-block;width:14px;height:14px;background:#166534;border-radius:3px;transform:rotate(45deg);margin-right:10px;vertical-align:middle;"></span>
                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#166534;letter-spacing:-0.4px;">Prism Capital</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#4E5A52;letter-spacing:0.4px;">INVITATION</span>
                  </td>
                </tr>
                <tr><td colspan="2"><span style="font-size:12px;color:#4E5A52;">Institutional Private Placements</span></td></tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 32px 4px 32px;">
              <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;color:#0F1512;font-weight:600;letter-spacing:-0.4px;">You have been invited to invest</h1>
              <p style="margin:0;color:#4E5A52;font-size:15px;line-height:1.6;">
                <strong style="color:#0F1512;">${escapeHtml(managerName)}</strong> has invited you to invest in
                <strong style="color:#0F1512;">${escapeHtml(projectName)}</strong> — a Shariah-compliant project on Prism Capital's institutional platform.
              </p>
              ${capLine}
            </td>
          </tr>

          <!-- Code panel (gold accent) -->
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <div style="border:1px solid #EED28A;border-radius:14px;background:#FEF9E9;padding:20px 20px 18px 20px;">
                <p style="margin:0 0 8px 0;color:#7A5300;font-size:11px;letter-spacing:1.2px;font-weight:600;text-transform:uppercase;">Your one-time sign-in code</p>
                <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:30px;letter-spacing:8px;color:#0F1512;font-weight:700;padding:6px 0 0 0;">${escapeHtml(code)}</div>
                <p style="margin:12px 0 0 0;color:#7A5300;font-size:12px;">Valid for 14 days · single use</p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:22px 32px 8px 32px;">
              <a href="${signInUrl}" style="display:inline-block;background:#166534;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 26px;border-radius:12px;font-size:14px;letter-spacing:0.2px;">Sign in to review the project →</a>
              <p style="margin:14px 0 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;color:#4E5A52;word-break:break-all;">${signInUrl}</p>
            </td>
          </tr>

          <!-- Next steps -->
          <tr>
            <td style="padding:8px 32px 22px 32px;">
              <table role="presentation" width="100%" style="border-top:1px solid #D5DED8;margin-top:6px;">
                <tr><td style="padding-top:18px;">
                  <p style="margin:0 0 10px 0;color:#166534;font-size:11px;letter-spacing:1.2px;font-weight:600;text-transform:uppercase;">Next steps</p>
                  <ol style="margin:0;padding-left:20px;color:#0F1512;font-size:14px;line-height:1.75;">
                    <li>Open the sign-in page (button above or paste the link).</li>
                    <li>Enter your email and the 8-character code.</li>
                    <li>Set a password for future sign-ins.</li>
                    <li>Review project terms, then pledge whole units of the project.</li>
                  </ol>
                </td></tr>
              </table>
            </td>
          </tr>

          <!-- Trust markers -->
          <tr>
            <td style="padding:6px 32px 22px 32px;">
              <table role="presentation" width="100%">
                <tr>
                  <td width="50%" style="padding:12px 8px 0 0;">
                    <p style="margin:0;color:#4E5A52;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;font-weight:600;">Four-eyes approvals</p>
                    <p style="margin:2px 0 0 0;color:#0F1512;font-size:12px;line-height:1.5;">Every distribution passes maker-checker review.</p>
                  </td>
                  <td width="50%" style="padding:12px 0 0 8px;">
                    <p style="margin:0;color:#4E5A52;font-size:11px;letter-spacing:0.6px;text-transform:uppercase;font-weight:600;">Double-entry ledger</p>
                    <p style="margin:2px 0 0 0;color:#0F1512;font-size:12px;line-height:1.5;">Every kobo posted to Prism's audited books.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 22px 32px;background:#F9FAF7;border-top:1px solid #D5DED8;">
              <p style="margin:0 0 6px 0;color:#4E5A52;font-size:11px;line-height:1.6;">
                You received this email because <strong style="color:#0F1512;">${escapeHtml(managerName)}</strong> invited you to a Prism Capital project. If you don't recognise this invitation you can safely ignore this message.
              </p>
              <p style="margin:0;color:#4E5A52;font-size:11px;line-height:1.6;">
                Private placement · Institutional investors only · Prism Capital
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `PRISM CAPITAL · Institutional Private Placements

You have been invited to invest in "${projectName}".

${managerName} has invited you to review this Shariah-compliant project on Prism Capital's institutional platform.
${minUnits ? `\nMinimum subscription: ${minUnits.toLocaleString()} unit${minUnits === 1 ? '' : 's'} on this project.\n` : ''}
YOUR ONE-TIME SIGN-IN CODE
${code}
Valid for 14 days · single use

Sign in: ${signInUrl}

NEXT STEPS
1. Open the sign-in page.
2. Enter your email and the 8-character code above.
3. Set a password for future sign-ins.
4. Review project terms, then pledge whole units.

—
Private placement · Institutional investors only · Prism Capital
`;

  return { html, text, subject };
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(
      role,
      ['LINE_MANAGER', 'ADMIN'],
      'Only line managers and admins can send invitations',
    );

    const body = await req.json();
    const projectId = String(body.projectId ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const rawMinUnits = body.minUnits;
    const minUnits =
      rawMinUnits === undefined || rawMinUnits === null || rawMinUnits === ''
        ? null
        : Number(rawMinUnits);
    const roundId = body.roundId ? String(body.roundId) : null;

    if (!projectId) throw new HttpError(400, 'projectId is required');
    if (!email || !isValidEmail(email)) {
      throw new HttpError(400, 'Valid email is required');
    }
    if (
      minUnits !== null &&
      (!Number.isInteger(minUnits) || minUnits <= 0)
    ) {
      throw new HttpError(400, 'minUnits must be a positive whole number');
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, approval_status, created_by, profiles:created_by(full_name)')
      .eq('id', projectId)
      .single();

    if (projectError || !project) throw new HttpError(404, 'Project not found');
    if (project.approval_status !== 'APPROVED') {
      throw new HttpError(400, 'Project must be approved before inviting investors');
    }
    if (role === 'LINE_MANAGER' && project.created_by !== user.id) {
      throw new HttpError(403, 'Line managers can only invite on their own projects');
    }

    if (roundId) {
      const { data: round, error: roundErr } = await supabase
        .from('funding_rounds')
        .select('id, project_id, status')
        .eq('id', roundId)
        .maybeSingle();
      if (roundErr || !round) throw new HttpError(400, 'Funding round not found');
      if (round.project_id !== projectId) {
        throw new HttpError(400, 'Funding round does not belong to this project');
      }
      if (round.status !== 'APPROVED') {
        throw new HttpError(400, 'Funding round must be approved before inviting');
      }
    }

    const admin = createServiceClient();

    // 1. Find or create investor profile (no Supabase email — we send our own).
    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .maybeSingle();
    if (profileError) throw new HttpError(400, profileError.message);

    let investorId: string;
    let isNewInvestor = false;

    if (existingProfile) {
      if (existingProfile.role !== 'INVESTOR') {
        throw new HttpError(400, 'This email belongs to a non-investor account');
      }
      investorId = existingProfile.id;
    } else {
      // Create auth user with email_confirm=true so they can sign in via magic link,
      // no password yet (they'll set it on first sign-in). Note: we intentionally do
      // NOT send Supabase's default invite email.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { role: 'INVESTOR', full_name: email.split('@')[0] },
      });
      if (createErr || !created.user) {
        throw new HttpError(400, createErr?.message ?? 'Failed to create investor account');
      }
      investorId = created.user.id;
      isNewInvestor = true;
      // Belt-and-braces: make sure profiles.role is INVESTOR (trigger should handle it)
      await admin
        .from('profiles')
        .update({ role: 'INVESTOR' })
        .eq('id', investorId);
    }

    // 2. Create the invite row (unique per project+email+round)
    const { data: inviteRow, error: inviteError } = await supabase
      .from('invites')
      .insert({
        project_id: projectId,
        email,
        investor_id: investorId,
        invited_by: user.id,
        status: 'INVITED',
        min_units: minUnits,
        is_new_investor: isNewInvestor,
        round_id: roundId,
      })
      .select(
        'id, project_id, email, investor_id, status, amount_minor, projected_profit_minor, min_units, is_new_investor, created_at',
      )
      .single();

    if (inviteError) {
      if (inviteError.code === '23505') {
        throw new HttpError(400, 'This email has already been invited to this raise');
      }
      throw new HttpError(400, inviteError.message);
    }

    // 3. Generate a first-signin code (via secure server-side RPC)
    const { data: codeData, error: codeErr } = await admin.rpc('generate_invite_signin_code', {
      p_invite_id: inviteRow.id,
    });
    if (codeErr || !codeData) {
      throw new HttpError(500, `Failed to generate sign-in code: ${codeErr?.message ?? 'unknown'}`);
    }
    const code = String(codeData);

    // 4. Send email via Resend
    const appUrl = Deno.env.get('APP_URL') ?? 'https://ribhshare.com';
    if (!Deno.env.get('APP_URL')) {
      console.warn('APP_URL secret is unset — invite links fall back to https://ribhshare.com');
    }
    const signInUrl = `${appUrl.replace(/\/$/, '')}/first-signin?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
    const managerName =
      // deno-lint-ignore no-explicit-any
      (project as any).profiles?.full_name ?? 'Your project manager';

    const { subject, html, text } = renderInviteEmail({
      projectName: project.name,
      managerName,
      code,
      signInUrl,
      minUnits,
    });

    try {
      await sendEmailViaResend({ to: email, subject, html, text });
    } catch (sendErr) {
      // Don't fail the whole request — the invite is created and the LM can share
      // the code manually. But surface the error to the caller so they know email
      // didn't go out (e.g. domain not verified).
      const message = sendErr instanceof Error ? sendErr.message : 'Unknown email error';
      return jsonResponse({
        invite: inviteRow,
        emailSent: false,
        emailError: message,
        signinCode: code,
      });
    }

    return jsonResponse({
      invite: inviteRow,
      emailSent: true,
      // Do NOT include the code in the response on success. LM should not see it.
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (error instanceof Error && error.message === 'Missing Authorization header') {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }
    return errorResponse(error);
  }
});
