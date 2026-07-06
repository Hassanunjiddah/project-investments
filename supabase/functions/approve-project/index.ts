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
    assertRole(role, ['CEO', 'ADMIN'], 'Only CEO and admin can approve projects');

    const body = await req.json();
    const projectId = String(body.projectId ?? '');
    const approvalStatus = body.approvalStatus;

    if (!projectId) throw new HttpError(400, 'projectId is required');
    if (approvalStatus !== 'APPROVED' && approvalStatus !== 'REJECTED') {
      throw new HttpError(400, 'approvalStatus must be APPROVED or REJECTED');
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ approval_status: approvalStatus })
      .eq('id', projectId)
      .select('id, approval_status, stage, name')
      .single();

    if (error) throw new HttpError(400, error.message);

    return jsonResponse({ project: data });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
