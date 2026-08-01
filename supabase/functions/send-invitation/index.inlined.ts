// send-invitation — FULLY INLINED (no _shared imports)
// Paste this whole file into Supabase Dashboard → Edge Functions → send-invitation → index.ts
//
// Required Supabase Secrets (Project Settings → Edge Functions → Secrets):
//   SUPABASE_URL                (auto-provided)
//   SUPABASE_ANON_KEY           (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//   RESEND_API_KEY              <-- your rotated Resend key
//   SENDER_EMAIL                <-- e.g. "RibhShare <noreply@yourdomain.com>" (or leave unset to use onboarding@resend.dev)
//   APP_URL                     <-- e.g. https://your-app.preview.emergentagent.com

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
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

// ---------- Auth / roles ----------
type UserRole = 'CEO' | 'ADMIN' | 'LINE_MANAGER' | 'INVESTOR';

async function getUserRole(supabase: SupabaseClient, userId: string): Promise<UserRole> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (error || !data?.role) throw new HttpError(403, 'Profile not found');
  return data.role as UserRole;
}

function assertRole(role: UserRole, allowed: UserRole[], message: string) {
  if (!allowed.includes(role)) throw new HttpError(403, message);
}

// ---------- Validation ----------
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- Email (Resend) ----------
type ResendSendInput = { to: string; subject: string; html: string; text?: string };

async function sendEmailViaResend(input: ResendSendInput): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const sender = Deno.env.get('SENDER_EMAIL') ?? 'onboarding@resend.dev';

  if (!apiKey) throw new Error('RESEND_API_KEY is not configured on this Supabase project.');

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

function renderInviteEmail(params: {
  projectName: string;
  managerName: string;
  code: string;
  signInUrl: string;
  minUnits?: number | null;
}): { html: string; text: string; subject: string } {
  const { projectName, managerName, code, signInUrl, minUnits } = params;
  const capLine = minUnits
    ? `Minimum subscription: <strong>${minUnits.toLocaleString()} unit${minUnits === 1 ? '' : 's'}</strong> on this project.`
    : '';

  const subject = `You've been invited to invest in ${projectName}`;

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f7fa;padding:32px 0;">
    <table role="presentation" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:32px 32px 16px 32px;">
          <h1 style="margin:0 0 8px 0;color:#0f172a;font-size:22px;line-height:1.3;">You're invited to invest</h1>
          <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
            ${escapeHtml(managerName)} has invited you to invest in
            <strong style="color:#0f172a;">${escapeHtml(projectName)}</strong> on RibhShare — a Shariah-compliant investment platform.
          </p>
          ${capLine ? `<p style="margin:12px 0 0 0;color:#475569;font-size:14px;line-height:1.6;">${capLine}</p>` : ''}
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 24px 32px;">
          <p style="margin:0 0 8px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Your first-time sign-in code</p>
          <div style="background:#0f766e;color:#ffffff;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:26px;letter-spacing:6px;padding:16px 20px;border-radius:12px;text-align:center;font-weight:700;">${code}</div>
          <p style="margin:12px 0 0 0;color:#64748b;font-size:12px;">Valid for 14 days. One-time use.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px 32px;">
          <a href="${signInUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px;font-size:14px;">Sign in to review the project</a>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 32px 32px;">
          <p style="margin:0 0 6px 0;color:#0f172a;font-size:13px;font-weight:600;">Next steps</p>
          <ol style="margin:0;padding-left:18px;color:#475569;font-size:13px;line-height:1.7;">
            <li>Tap the button above (or paste the link into your browser).</li>
            <li>Enter your email and the 8-character code above.</li>
            <li>Set a password for future sign-ins.</li>
            <li>Review the project terms and commit your investment.</li>
          </ol>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">You received this email because ${escapeHtml(managerName)} invited you to a RibhShare project. If you don't recognize this invitation you can safely ignore this email.</p>
        </td>
      </tr>
    </table>
  </div>`;

  const text = `You're invited to invest in "${projectName}" on RibhShare.

Your first-time sign-in code: ${code}
Valid for 14 days. One-time use.

Sign in here: ${signInUrl}

Next steps:
1. Open the sign-in page.
2. Enter your email and the code above.
3. Set a password for future sign-ins.
4. Review the project terms and commit your investment.
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
      await admin.from('profiles').update({ role: 'INVESTOR' }).eq('id', investorId);
    }

    // 2. Create the invite row
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
      })
      .select(
        'id, project_id, email, investor_id, status, amount_minor, projected_profit_minor, min_units, is_new_investor, created_at',
      )
      .single();

    if (inviteError) {
      if (inviteError.code === '23505') {
        throw new HttpError(400, 'This email has already been invited to this project');
      }
      throw new HttpError(400, inviteError.message);
    }

    // 3. Generate first-signin code via RPC
    const { data: codeData, error: codeErr } = await admin.rpc('generate_invite_signin_code', {
      p_invite_id: inviteRow.id,
    });
    if (codeErr || !codeData) {
      throw new HttpError(500, `Failed to generate sign-in code: ${codeErr?.message ?? 'unknown'}`);
    }
    const code = String(codeData);

    // 4. Send email via Resend
    const appUrl = Deno.env.get('APP_URL') ?? 'https://156f16db-1140-4b8c-a0ef-83ceaa005c45.preview.emergentagent.com';
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
      const message = sendErr instanceof Error ? sendErr.message : 'Unknown email error';
      return jsonResponse({
        invite: inviteRow,
        emailSent: false,
        emailError: message,
        signinCode: code,
      });
    }

    return jsonResponse({ invite: inviteRow, emailSent: true });
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
