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
    assertRole(
      role,
      ['LINE_MANAGER', 'CEO', 'ADMIN'],
      'Only line managers, CEO, and admins can submit projects',
    );

    const body = await req.json();
    const projectId = String(body.projectId ?? '');
    if (!projectId) throw new HttpError(400, 'projectId is required');

    const { data, error } = await supabase.rpc('submit_project_for_review', {
      p_project_id: projectId,
    });

    if (error) throw new HttpError(400, error.message);

    const project = data as {
      id: string;
      code: string;
      approval_status: string;
      stage: string;
      submitted_at: string;
    };

    return jsonResponse({
      projectId: project.id,
      code: project.code,
      approvalStatus: project.approval_status,
      stage: project.stage,
      submittedAt: project.submitted_at,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
