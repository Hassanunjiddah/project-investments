import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { createUserClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { parsePayAccount } from '../_shared/types.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(role, ['LINE_MANAGER', 'ADMIN'], 'Only line managers and admins can create projects');

    const body = await req.json();
    const payAccount = parsePayAccount(body.payAccount);

    const name = String(body.name ?? '').trim();
    const sector = String(body.sector ?? '').trim();
    const location = String(body.location ?? '').trim();
    const summary = String(body.summary ?? '').trim();
    const fullDetails = String(body.fullDetails ?? '').trim();
    const risks = String(body.risks ?? '').trim();
    const timeline = String(body.timeline ?? '').trim();
    const targetKobo = Number(body.targetKobo);

    if (!name || !sector || !location || !summary || !fullDetails || !risks || !timeline) {
      throw new HttpError(400, 'Missing required project fields');
    }
    if (!Number.isFinite(targetKobo) || targetKobo <= 0) {
      throw new HttpError(400, 'targetKobo must be a positive number');
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        sector,
        location,
        summary,
        full_details: fullDetails,
        risks,
        timeline,
        target_kobo: targetKobo,
        pay_account: payAccount,
        profit_split_investor_bps: body.profitSplitInvestorBps ?? 7000,
        exit_notice_days: body.exitNoticeDays ?? 90,
        early_exit_penalty_bps: body.earlyExitPenaltyBps ?? 500,
        created_by: user.id,
      })
      .select('id, approval_status, stage')
      .single();

    if (error) throw new HttpError(400, error.message);

    return jsonResponse({
      projectId: data.id,
      approvalStatus: data.approval_status,
      stage: data.stage,
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
