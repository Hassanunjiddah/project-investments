import { handleCors } from '../_shared/cors.ts';
import { createUserClient, createServiceClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(role, ['INVESTOR'], 'Only investors can submit payment proof');

    const form = await req.formData();
    const inviteId = String(form.get('inviteId') ?? '');
    const file = form.get('file');

    if (!inviteId) throw new HttpError(400, 'inviteId is required');
    if (!(file instanceof File)) throw new HttpError(400, 'file is required');

    const mimeType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new HttpError(400, 'File must be PDF or image (jpeg, png, webp)');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new HttpError(400, 'File must be 10 MB or smaller');
    }

    const { data: invite, error: inviteError } = await supabase
      .from('invites')
      .select('id, project_id, investor_id, status, email')
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) throw new HttpError(404, 'Invitation not found');
    if (invite.investor_id !== user.id) throw new HttpError(403, 'Forbidden');
    if (invite.status !== 'COMMITTED') {
      throw new HttpError(400, 'Proof can only be submitted when status is COMMITTED');
    }

    const fileName = file.name || 'proof';
    const storagePath = `${inviteId}/${fileName}`;
    const fileBytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(storagePath, fileBytes, { contentType: mimeType, upsert: true });

    if (uploadError) throw new HttpError(400, uploadError.message);

    const db = createServiceClient();

    // Investors can no longer UPDATE invites directly (hardening 20260904130000).
    // Service-role write, still gated on COMMITTED so a concurrent confirm/decline
    // cannot be clobbered back to PROOF_SUBMITTED.
    const { data, error } = await db
      .from('invites')
      .update({
        status: 'PROOF_SUBMITTED',
        proof_name: fileName,
        proof_file_name: fileName,
        proof_storage_path: storagePath,
        proof_mime_type: mimeType,
      })
      .eq('id', inviteId)
      .eq('investor_id', user.id)
      .eq('status', 'COMMITTED')
      .select(
        'id, project_id, investor_id, status, amount_minor, projected_profit_minor, max_investment_amount_minor, proof_name, proof_file_name, proof_storage_path, proof_mime_type, email',
      )
      .maybeSingle();

    if (error) throw new HttpError(400, error.message);
    if (!data) {
      throw new HttpError(409, 'This invitation changed while submitting proof. Refresh and try again.');
    }

    const investorLabel = (data.email as string | null) || 'Investor';

    // Cancel any prior open payment-proof tasks for this invite, then create one
    await db
      .from('tasks')
      .update({ status: 'CANCELLED' })
      .eq('invite_id', inviteId)
      .eq('kind', 'CONFIRM_PAYMENT_PROOF')
      .eq('status', 'OPEN');

    const { error: taskError } = await db.from('tasks').insert({
      kind: 'CONFIRM_PAYMENT_PROOF',
      title: `Confirm payment: ${investorLabel}`,
      project_id: invite.project_id,
      invite_id: inviteId,
      assignee_role: 'LINE_MANAGER',
      status: 'OPEN',
    });

    if (taskError) {
      console.error('Failed to create CONFIRM_PAYMENT_PROOF task', taskError);
      throw new HttpError(500, 'Proof saved but failed to create confirmation task');
    }

    return jsonResponse({ invite: data });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
