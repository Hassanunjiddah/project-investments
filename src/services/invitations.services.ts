import type { Invite, InviteStatus } from '@/src/types/invitation.types';
import { supabase } from '@/src/services/supabase';
import { invokeSendInvitation } from '@/src/services/edgeFunctions.services';
import { normalizeError } from '@/src/helpers/supabaseError';

type InviteRow = {
  id: string;
  project_id: string;
  investor_id: string;
  email?: string;
  status: string;
  amount_kobo: number | null;
  projected_profit_kobo: number | null;
  proof_name?: string | null;
  proof_file_name?: string | null;
  proof_storage_path?: string | null;
  projects?: { name: string } | null;
  profiles?: { full_name: string } | null;
  project_name?: string;
};

function mapRowToInvite(row: InviteRow): Invite {
  return {
    id: row.id,
    projectId: row.project_id,
    investorId: row.investor_id,
    email: row.email,
    status: row.status as InviteStatus,
    amountKobo: row.amount_kobo ?? undefined,
    projectedProfitKobo: row.projected_profit_kobo ?? undefined,
    projectName: row.projects?.name ?? row.project_name,
    investorName: row.profiles?.full_name,
    proofName: row.proof_name ?? undefined,
    proofFileName: row.proof_file_name ?? undefined,
    proofStoragePath: row.proof_storage_path ?? undefined,
  };
}

const INVITE_SELECT =
  'id, project_id, email, investor_id, status, amount_kobo, projected_profit_kobo, proof_name, proof_file_name, proof_storage_path, projects(name), profiles(full_name)';

export async function fetchInvitations(_userId: string): Promise<Invite[]> {
  const { data, error } = await supabase.rpc('list_investor_invitations');

  if (error) throw normalizeError(error);
  return (data ?? []).map((row) => mapRowToInvite(row as InviteRow));
}

export async function fetchInvitesForProject(projectId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select(INVITE_SELECT)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []).map((row) => mapRowToInvite(row as InviteRow));
}

export type CreateInviteResult = {
  invite: Invite;
  newAccount: { email: string; password: string } | null;
};

export async function createInvite(input: {
  projectId: string;
  email: string;
}): Promise<CreateInviteResult> {
  const { invite, newAccount } = await invokeSendInvitation(input);
  const { data, error } = await supabase
    .from('invites')
    .select(INVITE_SELECT)
    .eq('id', invite.id)
    .single();

  if (error) throw normalizeError(error);
  return { invite: mapRowToInvite(data as InviteRow), newAccount };
}

export async function acceptInvite(inviteId: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .update({ status: 'ACCEPTED' })
    .eq('id', inviteId)
    .select(INVITE_SELECT)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as InviteRow);
}

export async function commitInvestment(inviteId: string, amountKobo: number): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .update({ status: 'COMMITTED', amount_kobo: amountKobo })
    .eq('id', inviteId)
    .select(INVITE_SELECT)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as InviteRow);
}

export async function confirmInvitePayment(inviteId: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .update({ status: 'CONFIRMED' })
    .eq('id', inviteId)
    .select(INVITE_SELECT)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as InviteRow);
}

export async function declineInvite(inviteId: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .update({ status: 'DECLINED' })
    .eq('id', inviteId)
    .select(INVITE_SELECT)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToInvite(data as InviteRow);
}
