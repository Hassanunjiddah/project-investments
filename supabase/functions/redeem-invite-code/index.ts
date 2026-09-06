// redeem-invite-code
// Verifies (email, 8-char code) against the invites table, then issues a
// magic-link token the client can pass to supabase.auth.verifyOtp to get a
// real session. Marks the code as redeemed. Client should then force the user
// through the "set password" screen if `passwordAlreadySet` is false.

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabaseClient.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { isValidEmail } from '../_shared/password.ts';

// ---------- In-memory pre-filter (per-isolate; the durable limit lives in the
// check_signin_rate_limit RPC — this only keeps hot brute-force off the DB) ----------
type Bucket = { count: number; resetAt: number };
const emailBuckets = new Map<string, Bucket>();
const ipBuckets = new Map<string, Bucket>();

const EMAIL_LIMIT = 8; // max attempts per email
const IP_LIMIT = 30; // max attempts per IP
const WINDOW_MS = 10 * 60 * 1000; // 10-minute rolling window

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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    const code = String(body.code ?? '').trim().toUpperCase();

    if (!email || !isValidEmail(email)) throw new HttpError(400, 'Valid email is required');
    if (!code || code.length !== 8) throw new HttpError(400, 'A valid 8-character code is required');

    // 0a. Cheap in-memory pre-filter so hot brute force never reaches the DB.
    const ip = getClientIp(req);
    const emailOk = checkBucket(email, emailBuckets, EMAIL_LIMIT);
    const ipOk = checkBucket(ip, ipBuckets, IP_LIMIT);
    if (!emailOk || !ipOk) {
      await delay(400);
      throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.');
    }

    const admin = createServiceClient();

    // 0b. Durable, DB-backed rate limiting — this endpoint is unauthenticated
    // and issues session credentials, so brute-force protection cannot live
    // only in per-isolate memory (it resets on cold start and isn't shared
    // across isolates). 8 attempts / email, 30 / IP, 10-minute window.
    const { data: allowed, error: rateErr } = await admin.rpc('check_signin_rate_limit', {
      p_email: email,
      p_ip: ip === 'unknown' ? null : ip,
    });
    if (rateErr) {
      throw new HttpError(500, 'Could not verify the code. Please try again.');
    }
    if (!allowed) {
      await delay(400);
      throw new HttpError(429, 'Too many attempts. Please wait 10 minutes and try again.');
    }

    // 1. Verify the code + email. Investor codes live on invites; staff codes
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
      // Project owners: deep-link set-password / home to their assigned project.
      const { data: owned } = await admin
        .from('projects')
        .select('id')
        .eq('project_owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (owned?.id) projectId = owned.id;
    }

    // 2. Generate a magic-link OTP so the client can exchange it for a session.
    // We use type=magiclink (not signup) since the user was created ahead of time
    // by send-invitation.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    if (linkErr || !linkData?.properties) {
      throw new HttpError(500, linkErr?.message ?? 'Failed to generate sign-in link');
    }

    // Supabase returns { hashed_token, email_otp, action_link, ... }
    // The client uses `token_hash` + `email` + `type='magiclink'` on verifyOtp.
    const tokenHash =
      // deno-lint-ignore no-explicit-any
      (linkData.properties as any).hashed_token as string | undefined;
    if (!tokenHash) {
      throw new HttpError(500, 'Sign-in link is missing token_hash');
    }

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
