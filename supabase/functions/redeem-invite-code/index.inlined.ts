// redeem-invite-code — FULLY INLINED (no _shared imports)
// Paste this whole file into Supabase Dashboard → Edge Functions → redeem-invite-code → index.ts
//
// Required Supabase Secrets (Project Settings → Edge Functions → Secrets):
//   SUPABASE_URL                (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-provided)
//
// Note: This function does NOT need SUPABASE_ANON_KEY or user auth — it's
// intentionally callable without a session (investor's very first sign-in).
// Make sure "Verify JWT" is DISABLED for this function in the Supabase Dashboard.

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

// ---------- Supabase service client ----------
function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('Missing Supabase service role environment variables');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------- Validation ----------
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const code = String(body.code ?? '').trim().toUpperCase();

    if (!email || !isValidEmail(email)) throw new HttpError(400, 'Valid email is required');
    if (!code || code.length !== 8) throw new HttpError(400, 'A valid 8-character code is required');

    const admin = createServiceClient();

    // 1. Verify code + email against invites (marks as redeemed atomically)
    const { data: redeemRows, error: redeemErr } = await admin.rpc('redeem_invite_signin_code', {
      p_email: email,
      p_code: code,
    });
    if (redeemErr) throw new HttpError(400, redeemErr.message);
    const redeem = Array.isArray(redeemRows) ? redeemRows[0] : redeemRows;
    if (!redeem) throw new HttpError(400, 'Invalid email or code');

    // 2. Generate a magic-link OTP the client can exchange for a session
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData?.properties) {
      throw new HttpError(500, linkErr?.message ?? 'Failed to generate sign-in link');
    }

    const tokenHash =
      // deno-lint-ignore no-explicit-any
      (linkData.properties as any).hashed_token as string | undefined;
    if (!tokenHash) throw new HttpError(500, 'Sign-in link is missing token_hash');

    return jsonResponse({
      email,
      tokenHash,
      inviteId: redeem.invite_id,
      projectId: redeem.project_id,
      investorId: redeem.investor_id,
      passwordAlreadySet: !!redeem.password_already_set,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
