import { handleCors } from '../_shared/cors.ts';
import { createUserClient, createServiceClient, requireUser } from '../_shared/supabaseClient.ts';
import { getUserRole, isCeoOrAdmin } from '../_shared/auth.ts';
import {
  canSeeFullDetails,
  canSeePayAccount,
  type InviteStatus,
  type PayAccount,
} from '../_shared/types.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';

type DocSummary = { id: string; kind: string; title: string; fileName: string };

function mapPayAccount(value: unknown): PayAccount | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const obj = value as Record<string, unknown>;
  if (typeof obj.bankName !== 'string') return undefined;
  return {
    bankName: obj.bankName,
    accountName: String(obj.accountName ?? ''),
    accountNumber: String(obj.accountNumber ?? ''),
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);

    const body = await req.json();
    const inviteIdRaw = body.inviteId ? String(body.inviteId) : '';
    const projectIdRaw = body.projectId ? String(body.projectId) : '';

    if (!inviteIdRaw && !projectIdRaw) {
      throw new HttpError(400, 'inviteId or projectId is required');
    }

    const db = createServiceClient();

    let inviteQuery = db
      .from('invites')
      .select(
        'id, project_id, investor_id, status, amount_minor, projected_profit_minor, max_investment_amount_minor, proof_name, proof_file_name, proof_storage_path, created_at',
      );

    if (inviteIdRaw) {
      inviteQuery = inviteQuery.eq('id', inviteIdRaw);
    } else {
      inviteQuery = inviteQuery.eq('project_id', projectIdRaw).eq('investor_id', user.id);
    }

    const { data: invite, error: inviteError } = await inviteQuery.maybeSingle();

    if (inviteError || !invite) throw new HttpError(404, 'Invitation not found');

    const { data: project, error: projectError } = await db
      .from('projects')
      .select(
        'id, name, sector, location, summary, full_details, risks, timeline, pay_account, stage, approval_status, target_minor, raised_minor, profit_split_investor_bps, exit_notice_days, early_exit_penalty_bps, created_by',
      )
      .eq('id', invite.project_id)
      .single();

    if (projectError || !project) throw new HttpError(404, 'Project not found');

    const isInvestorOwner = role === 'INVESTOR' && invite.investor_id === user.id;
    const isManager =
      isCeoOrAdmin(role) || (role === 'LINE_MANAGER' && project.created_by === user.id);

    if (!isInvestorOwner && !isManager) {
      throw new HttpError(403, 'Forbidden');
    }

    const status = invite.status as InviteStatus;
    const managerView = isManager;

    let documents: DocSummary[] | undefined;
    if (managerView || canSeeFullDetails(status)) {
      if (managerView) {
        const { data: docs } = await db
          .from('project_docs')
          .select('id, kind, title, file_name')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false });
        documents = (docs ?? []).map((d) => ({
          id: d.id,
          kind: d.kind,
          title: d.title,
          fileName: d.file_name,
        }));
      } else {
        const { data: docs } = await db.rpc('get_project_docs_summary', {
          p_project_id: project.id,
          p_investor_id: user.id,
        });
        documents = (docs ?? []).map(
          (d: { id: string; kind: string; title: string; file_name: string }) => ({
            id: d.id,
            kind: d.kind,
            title: d.title,
            fileName: d.file_name,
          }),
        );
      }
    }

    const payAccountRaw = mapPayAccount(project.pay_account);
    let payAccount: PayAccount | undefined;
    if (managerView || canSeePayAccount(status)) {
      payAccount = payAccountRaw;
    }

    const projectPayload = managerView
      ? {
          id: project.id,
          name: project.name,
          sector: project.sector,
          location: project.location,
          summary: project.summary,
          fullDetails: project.full_details,
          risks: project.risks,
          timeline: project.timeline,
          stage: project.stage,
          approvalStatus: project.approval_status,
          targetKobo: project.target_minor,
          raisedKobo: project.raised_minor,
        }
      : {
          id: project.id,
          name: project.name,
          sector: project.sector,
          summary: project.summary,
          risks: project.risks,
          targetKobo: project.target_minor,
          ...(canSeeFullDetails(status)
            ? {
                fullDetails: project.full_details,
                timeline: project.timeline,
                location: project.location,
              }
            : {}),
        };

    return jsonResponse({
      invite: {
        id: invite.id,
        projectId: invite.project_id,
        investorId: invite.investor_id,
        status: invite.status,
        amountMinor: invite.amount_minor,
        projectedProfitMinor: invite.projected_profit_minor,
        maxInvestmentAmountMinor: invite.max_investment_amount_minor,
        proofName: invite.proof_name,
        proofFileName: invite.proof_file_name,
        proofStoragePath:
          managerView || status === 'PROOF_SUBMITTED' || status === 'CONFIRMED'
            ? invite.proof_storage_path
            : undefined,
      },
      project: projectPayload,
      documents,
      payAccount,
      mudarabahTerms: {
        profitSplitInvestorBps: project.profit_split_investor_bps,
        exitNoticeDays: project.exit_notice_days,
        earlyExitPenaltyBps: project.early_exit_penalty_bps,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});
