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
      'Only line managers and admins can confirm invite payments',
    );

    const body = await req.json();
    const inviteId = String(body.inviteId ?? '');
    if (!inviteId) throw new HttpError(400, 'inviteId is required');

    const { data, error } = await supabase.rpc('confirm_invite_payment', {
      p_invite_id: inviteId,
    });

    if (error) throw new HttpError(400, error.message);
    if (!data) throw new HttpError(404, 'Invitation not found');

    return jsonResponse({ invite: data });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
