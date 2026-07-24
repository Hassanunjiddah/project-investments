import type { Invite, InviteStatus } from '@/src/types/invitation.types';
import type { ProjectStage } from '@/src/types/project.types';
import { supabase } from '@/src/services/supabase';
import {
  invokeConfirmInvitePayment,
  invokeSendInvitation,
} from '@/src/services/edgeFunctions.services';
import { getProjectBannerUrl } from '@/src/services/banner.services';
import { AppError, normalizeError } from '@/src/helpers/supabaseError';

type InviteRow = {
  id: string;
  project_id: string;
  investor_id: string;
  email?: string;
  status: string;
  amount_minor: number | null;
  projected_profit_minor: number | null;
  max_investment_amount_minor?: number | null;
  proof_name?: string | null;
  proof_file_name?: string | null;
  proof_storage_path?: string | null;
  units_pledged?: number | null;
  units_allotted?: number | null;
  payment_reference?: string | null;
  pledged_at?: string | null;
  pledge_expires_at?: string | null;
  verified_at?: string | null;
  projects?: { name: string } | null;
  profiles?: { full_name: string } | null;
  investor?: { full_name: string } | null;
  project_name?: string;
  project_sector?: string;
  project_banner_storage_path?: string | null;
  project_stage?: string;
};

function mapRowToInvite(row: InviteRow): Invite {
  return {
    id: row.id,
    projectId: row.project_id,
    investorId: row.investor_id,
    email: row.email,
    status: row.status as InviteStatus,
    amountMinor: row.amount_minor ?? undefined,
    projectedProfitMinor: row.projected_profit_minor ?? undefined,
    maxInvestmentAmountMinor: row.max_investment_amount_minor ?? undefined,
    projectName: row.projects?.name ?? row.project_name,
    projectSector: row.project_sector,
    projectBannerUrl: getProjectBannerUrl(row.project_banner_storage_path),
    projectStage: row.project_stage as ProjectStage | undefined,
    investorName: row.investor?.full_name ?? row.profiles?.full_name,
    proofName: row.proof_name ?? undefined,
    proofFileName: row.proof_file_name ?? undefined,
    proofStoragePath: row.proof_storage_path ?? undefined,
    unitsPledged: row.units_pledged ?? undefined,
    unitsAllotted: row.units_allotted ?? undefined,
    paymentReference: row.payment_reference ?? undefined,
    pledgedAt: row.pledged_at ?? undefined,
    pledgeExpiresAt: row.pledge_expires_at ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
  };
}

const INVITE_SELECT =
  'id, project_id, email, investor_id, status, amount_minor, projected_profit_minor, max_investment_amount_minor, proof_name, proof_file_name, proof_storage_path, units_pledged, units_allotted, payment_reference, pledged_at, pledge_expires_at, verified_at, projects(name), investor:profiles!investor_id(full_name)';

export type FetchInviteParams = { inviteId: string } | { userId: string; projectId: string };

export function inviteLookupKey(params: FetchInviteParams): string {
  if ('inviteId' in params) return `invite:${params.inviteId}`;
  return `user:${params.userId}:project:${params.projectId}`;
}

export async function fetchInvite(params: FetchInviteParams): Promise<Invite | null> {
  let query = supabase.from('invites').select(INVITE_SELECT);

  if ('inviteId' in params) {
    query = query.eq('id', params.inviteId);
  } else {
    query = query.eq('project_id', params.projectId).eq('investor_id', params.userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw normalizeError(error);
  return data ? mapRowToInvite(data as unknown as InviteRow) : null;
}

export async function fetchInvitations(_userId: string): Promise<Invite[]> {
  const { data, error } = await supabase.rpc('list_investor_invitations');

  if (error) throw normalizeError(error);
  return (data ?? []).map((row) => mapRowToInvite(row as unknown as InviteRow));
}

export async function fetchInvitesForProject(projectId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select(INVITE_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []).map((row) => mapRowToInvite(row as unknown as InviteRow));
}

export type CreateInviteResult = {
  invite: Invite;
  emailSent: boolean;
  emailError?: string;
  signinCode?: string;
};

export async function createInvite(input: {
  projectId: string;
  email: string;
  maxInvestmentAmountMinor?: number;
}): Promise<CreateInviteResult> {
  const { invite, emailSent, emailError, signinCode } = await invokeSendInvitation(input);
  const { data, error } = await supabase
    .from('invites')
    .select(INVITE_SELECT)
    .eq('id', invite.id)
    .single();

  if (error) throw normalizeError(error);
  return { invite: mapRowToInvite(data as unknown as InviteRow), emailSent, emailError, signinCode };
}

export async function acceptInvite(inviteId: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .update({ status: 'ACCEPTED' })
    .eq('id', inviteId)
    .select(INVITE_SELECT)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as unknown as InviteRow);
}

export async function commitInvestment(inviteId: string, amountMinor: number): Promise<Invite> {
  if (amountMinor <= 0) {
    throw new AppError('Amount must be greater than zero');
  }

  const { data, error } = await supabase.rpc('commit_invite_investment', {
    p_invite_id: inviteId,
    p_amount_minor: amountMinor,
  });

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as unknown as InviteRow);
}

/**
 * Prism unit-model pledge. Investor picks whole units; server computes
 * amount_minor, generates PRSM-<code>-INV<seq> reference, sets 72h expiry.
 * Falls back to legacy commit_invite_investment if the project pre-dates
 * the unit backfill (units column null on projects).
 */
export async function pledgeUnits(inviteId: string, units: number): Promise<Invite> {
  if (!Number.isInteger(units) || units <= 0) {
    throw new AppError('Units must be a positive whole number');
  }

  const { data, error } = await (supabase.rpc as any)('pledge_units', {
    p_invite_id: inviteId,
    p_units: units,
  });

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as unknown as InviteRow);
}

export async function confirmInvitePayment(inviteId: string): Promise<Invite> {
  const { invite } = await invokeConfirmInvitePayment(inviteId);
  const { data, error } = await supabase
    .from('invites')
    .select(INVITE_SELECT)
    .eq('id', invite.id)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as unknown as InviteRow);
}

export async function declineInvite(inviteId: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .update({ status: 'DECLINED' })
    .eq('id', inviteId)
    .select(INVITE_SELECT)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as unknown as InviteRow);
}
