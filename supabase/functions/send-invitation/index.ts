import { handleCors } from '../_shared/cors.ts';
import { createUserClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(role, ['LINE_MANAGER', 'ADMIN'], 'Only line managers and admins can send invitations');

    const body = await req.json();
    const projectId = String(body.projectId ?? '');
    const investorId = String(body.investorId ?? '');
    const amountKobo = Number(body.amountKobo);
    const projectedProfitKobo = Number(body.projectedProfitKobo);

    if (!projectId || !investorId) throw new HttpError(400, 'projectId and investorId are required');
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      throw new HttpError(400, 'amountKobo must be positive');
    }
    if (!Number.isFinite(projectedProfitKobo) || projectedProfitKobo < 0) {
      throw new HttpError(400, 'projectedProfitKobo must be zero or positive');
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, approval_status, created_by')
      .eq('id', projectId)
      .single();

    if (projectError || !project) throw new HttpError(404, 'Project not found');
    if (project.approval_status !== 'APPROVED') {
      throw new HttpError(400, 'Project must be approved before inviting investors');
    }
    if (role === 'LINE_MANAGER' && project.created_by !== user.id) {
      throw new HttpError(403, 'Line managers can only invite on their own projects');
    }

    const { data: investor, error: investorError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', investorId)
      .single();

    if (investorError || !investor) throw new HttpError(404, 'Investor not found');
    if (investor.role !== 'INVESTOR') throw new HttpError(400, 'Selected user is not an investor');

    const { data, error } = await supabase
      .from('invites')
      .insert({
        project_id: projectId,
        investor_id: investorId,
        amount_kobo: amountKobo,
        projected_profit_kobo: projectedProfitKobo,
        status: 'INVITED',
      })
      .select(
        'id, project_id, investor_id, status, amount_kobo, projected_profit_kobo, created_at',
      )
      .single();

    if (error) throw new HttpError(400, error.message);

    return jsonResponse({ invite: data });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
