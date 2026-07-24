import { handleCors } from '../_shared/cors.ts';
import { createUserClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';
import { parsePayAccount } from '../_shared/types.ts';

type DurationUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

function parseDurationUnit(value: unknown): DurationUnit {
  const unit = String(value ?? 'MONTHS').toUpperCase();
  if (unit === 'DAYS' || unit === 'WEEKS' || unit === 'MONTHS') return unit;
  throw new HttpError(400, 'durationUnit must be DAYS, WEEKS, or MONTHS');
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(
      role,
      ['LINE_MANAGER', 'CEO', 'ADMIN'],
      'Only line managers, CEO, and admins can create projects',
    );

    const body = await req.json();
    const payAccount = parsePayAccount(body.payAccount);

    const name = String(body.name ?? '').trim();
    const sector = String(body.sector ?? '').trim();
    const location = String(body.location ?? '').trim();
    const summary = String(body.summary ?? '').trim();
    const fullDetails = String(body.fullDetails ?? '').trim();
    const risks = String(body.risks ?? '').trim();
    const timeline = String(body.timeline ?? '').trim();
    const targetMinor = Number(body.targetMinor ?? body.targetKobo);
    const durationValue = Number(body.durationValue);
    const durationUnit = parseDurationUnit(body.durationUnit);
    const estimatedRoiBps = Number(body.estimatedRoiBps ?? 0);
    const isPublic = Boolean(body.isPublic ?? false);

    // Prism unit model (P1). Optional at creation time to keep backwards
    // compatibility with any older UI paths that skip these fields.
    const totalUnits =
      body.totalUnits !== undefined && body.totalUnits !== null
        ? Number(body.totalUnits)
        : undefined;
    const minUnitsPerInvestor =
      body.minUnitsPerInvestor !== undefined && body.minUnitsPerInvestor !== null
        ? Number(body.minUnitsPerInvestor)
        : undefined;
    const platformFeeBps =
      body.platformFeeBps !== undefined && body.platformFeeBps !== null
        ? Number(body.platformFeeBps)
        : undefined;

    if (totalUnits !== undefined) {
      if (!Number.isInteger(totalUnits) || totalUnits <= 0) {
        throw new HttpError(400, 'totalUnits must be a positive integer');
      }
      if (targetMinor % totalUnits !== 0) {
        throw new HttpError(
          400,
          'targetMinor must be evenly divisible by totalUnits (no fractional unit price)',
        );
      }
    }
    if (minUnitsPerInvestor !== undefined) {
      if (!Number.isInteger(minUnitsPerInvestor) || minUnitsPerInvestor <= 0) {
        throw new HttpError(400, 'minUnitsPerInvestor must be a positive integer');
      }
      if (totalUnits !== undefined && minUnitsPerInvestor > totalUnits) {
        throw new HttpError(400, 'minUnitsPerInvestor cannot exceed totalUnits');
      }
    }
    if (platformFeeBps !== undefined) {
      if (!Number.isFinite(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10000) {
        throw new HttpError(400, 'platformFeeBps must be between 0 and 10000');
      }
    }

    if (!name || !sector || !location || !summary || !fullDetails || !risks || !timeline) {
      throw new HttpError(400, 'Missing required project fields');
    }
    if (!Number.isFinite(targetMinor) || targetMinor <= 0) {
      throw new HttpError(400, 'targetMinor must be a positive number');
    }
    if (!Number.isFinite(durationValue) || durationValue <= 0) {
      throw new HttpError(400, 'durationValue must be a positive number');
    }
    if (!Number.isFinite(estimatedRoiBps) || estimatedRoiBps < 0 || estimatedRoiBps > 10000) {
      throw new HttpError(400, 'estimatedRoiBps must be between 0 and 10000');
    }

    const isCeoOrAdmin = role === 'CEO' || role === 'ADMIN';
    const autoApprove = isCeoOrAdmin;

    const insertRow: Record<string, unknown> = {
      name,
      sector,
      location,
      summary,
      full_details: fullDetails,
      risks,
      timeline,
      target_minor: targetMinor,
      duration_value: durationValue,
      duration_unit: durationUnit,
      estimated_roi_bps: estimatedRoiBps,
      is_public: isPublic,
      pay_account: payAccount,
      profit_split_investor_bps: body.profitSplitInvestorBps ?? 7000,
      exit_notice_days: body.exitNoticeDays ?? 90,
      early_exit_penalty_bps: body.earlyExitPenaltyBps ?? 500,
      currency_code: body.currencyCode ?? 'NGN',
      created_by: user.id,
      stage: autoApprove ? 'ACCEPTANCE' : 'INITIATION',
      approval_status: autoApprove ? 'APPROVED' : 'PENDING',
      total_units: totalUnits ?? null,
      min_units_per_investor: minUnitsPerInvestor ?? 1,
      platform_fee_bps: platformFeeBps ?? 750,
    };

    if (autoApprove) {
      insertRow.approved_by = user.id;
      insertRow.approved_at = new Date().toISOString();
      insertRow.submitted_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(insertRow)
      .select('id, code, approval_status, stage')
      .single();

    if (error) throw new HttpError(400, error.message);

    return jsonResponse({
      projectId: data.id,
      code: data.code,
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
