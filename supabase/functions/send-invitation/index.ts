import { handleCors } from '../_shared/cors.ts';
import { createUserClient, createServiceClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { isValidEmail } from '../_shared/password.ts';
import { sendEmailViaResend, renderInviteEmail } from '../_shared/email.ts';

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
    const rawMax = body.maxInvestmentAmountMinor ?? body.amountMinor;
    const maxInvestmentAmountMinor =
      rawMax === undefined || rawMax === null || rawMax === ''
        ? null
        : Number(rawMax);

    if (!projectId) throw new HttpError(400, 'projectId is required');
    if (!email || !isValidEmail(email)) {
      throw new HttpError(400, 'Valid email is required');
    }
    if (
      maxInvestmentAmountMinor !== null &&
      (!Number.isFinite(maxInvestmentAmountMinor) || maxInvestmentAmountMinor <= 0)
    ) {
      throw new HttpError(400, 'maxInvestmentAmountMinor must be a positive number');
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

    // 2. Create the invite row (unique per project+email)
    const { data: inviteRow, error: inviteError } = await supabase
      .from('invites')
      .insert({
        project_id: projectId,
        email,
        investor_id: investorId,
        invited_by: user.id,
        status: 'INVITED',
        max_investment_amount_minor: maxInvestmentAmountMinor,
        is_new_investor: isNewInvestor,
      })
      .select(
        'id, project_id, email, investor_id, status, amount_minor, projected_profit_minor, max_investment_amount_minor, is_new_investor, created_at',
      )
      .single();

    if (inviteError) {
      if (inviteError.code === '23505') {
        throw new HttpError(400, 'This email has already been invited to this project');
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
      maxInvestmentNaira: maxInvestmentAmountMinor ? Math.round(maxInvestmentAmountMinor / 100) : null,
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
