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

// ---------- Rate limiting (in-memory, per-instance) ----------
// This is intentionally aggressive because a successful redeem returns a
// login credential. The code alphabet is [A-Z0-9] = 36^8 ≈ 2.8T combinations,
// so even at these limits brute-force is computationally infeasible.
type Bucket = { count: number; resetAt: number };
const emailBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

const EMAIL_LIMIT = 8;              // max attempts per email
const IP_LIMIT = 30;                // max attempts per IP
const WINDOW_MS = 10 * 60 * 1000;   // 10-minute rolling window

function checkBucket(key: string, store: Map<string, Bucket>, limit: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || 'unknown';
}

// Small helper: constant-ish delay on failure to reduce timing leaks.
function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

    // Rate-limit BEFORE hitting the DB, so brute-forcers can't consume DB CPU.
    const ip = getClientIp(req);
    const emailOk = checkBucket(email, emailBuckets, EMAIL_LIMIT);
    const ipOk = checkBucket(ip, ipBuckets, IP_LIMIT);
    if (!emailOk || !ipOk) {
      // Deliberately vague error + delay to slow scripted abuse.
      await delay(400);
      throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
    }

    const admin = createServiceClient();

    // 1. Verify code + email. Investor codes live on invites; staff codes
    // (Line Managers created by the CEO) live in staff_signin_codes. Try the
    // invite path first, then fall back to staff — both mark the code
    // redeemed atomically on success.
    let inviteId: string | null = null;
    let projectId: string | null = null;
    let userId: string | null = null;
    let passwordAlreadySet = false;

    const { data: redeemRows, error: redeemErr } = await admin.rpc('redeem_invite_signin_code', {
      p_email: email,
      p_code: code,
    });
    const redeem = Array.isArray(redeemRows) ? redeemRows[0] : redeemRows;

    if (!redeemErr && redeem) {
      inviteId = redeem.invite_id;
      projectId = redeem.project_id;
      userId = redeem.investor_id;
      passwordAlreadySet = !!redeem.password_already_set;
    } else {
      const { data: staffRows, error: staffErr } = await admin.rpc('redeem_staff_signin_code', {
        p_email: email,
        p_code: code,
      });
      const staff = Array.isArray(staffRows) ? staffRows[0] : staffRows;
      if (staffErr || !staff) {
        // Surface the most specific message (expired / already used) from
        // whichever path recognised the email+code pair.
        const inviteMsg = redeemErr?.message ?? 'Invalid email or code';
        const staffMsg = staffErr?.message ?? 'Invalid email or code';
        const specific =
          staffMsg !== 'Invalid email or code'
            ? staffMsg
            : inviteMsg !== 'Invalid email or code'
              ? inviteMsg
              : 'Invalid email or code';
        await delay(300);
        throw new HttpError(400, specific);
      }
      userId = staff.user_id;
      passwordAlreadySet = !!staff.password_already_set;
      const { data: owned } = await admin
        .from('projects')
        .select('id')
        .eq('project_owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (owned?.id) projectId = owned.id;
    }

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
      inviteId,
      projectId,
      investorId: userId,
      passwordAlreadySet,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
