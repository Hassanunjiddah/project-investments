import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ApprovalStatus,
  PayAccount,
} from '@/src/types/project.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import type { Database, Json } from '@/src/types/supabase.types';
import { invokeApproveProject } from '@/src/services/edgeFunctions.services';

const PROJECT_COLUMNS =
  'id, name, sector, location, summary, full_details, risks, timeline, pay_account, stage, approval_status, target_kobo, raised_kobo, profit_split_investor_bps, exit_notice_days, early_exit_penalty_bps, created_by, created_at';

function mapPayAccount(value: Json | null): PayAccount | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const obj = value as Record<string, Json | undefined>;
  if (typeof obj.bankName !== 'string') return undefined;
  return {
    bankName: obj.bankName,
    accountName: String(obj.accountName ?? ''),
    accountNumber: String(obj.accountNumber ?? ''),
  };
}

function mapRowToProject(row: {
  id: string;
  name: string;
  sector: string;
  location: string;
  summary: string;
  full_details: string;
  risks: string;
  timeline: string;
  pay_account: Json | null;
  stage: string;
  approval_status: string;
  target_kobo: number;
  raised_kobo: number;
  profit_split_investor_bps: number;
  exit_notice_days: number;
  early_exit_penalty_bps: number;
  created_by: string;
  created_at?: string;
}): Project {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    location: row.location,
    summary: row.summary,
    fullDetails: row.full_details,
    risks: row.risks,
    timeline: row.timeline,
    payAccount: mapPayAccount(row.pay_account),
    stage: row.stage as Project['stage'],
    approvalStatus: row.approval_status as Project['approvalStatus'],
    targetKobo: row.target_kobo,
    raisedKobo: row.raised_kobo,
    profitSplitInvestorBps: row.profit_split_investor_bps,
    exitNoticeDays: row.exit_notice_days,
    earlyExitPenaltyBps: row.early_exit_penalty_bps,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []).map(mapRowToProject);
}

export async function fetchPendingProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('approval_status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []).map(mapRowToProject);
}

export async function fetchProjectById(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', id)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProject(data);
}

export async function createProject(input: CreateProjectInput, userId: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: input.name,
      sector: input.sector,
      location: input.location,
      summary: input.summary,
      full_details: input.fullDetails,
      risks: input.risks,
      timeline: input.timeline,
      target_kobo: input.targetKobo,
      profit_split_investor_bps: input.profitSplitInvestorBps ?? 7000,
      exit_notice_days: input.exitNoticeDays ?? 90,
      early_exit_penalty_bps: input.earlyExitPenaltyBps ?? 500,
      pay_account: input.payAccount ?? null,
      created_by: userId,
    })
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProject(data);
}

export async function updateProject(id: string, patch: UpdateProjectInput): Promise<Project> {
  const update: Database['public']['Tables']['projects']['Update'] = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.sector !== undefined) update.sector = patch.sector;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.summary !== undefined) update.summary = patch.summary;
  if (patch.fullDetails !== undefined) update.full_details = patch.fullDetails;
  if (patch.risks !== undefined) update.risks = patch.risks;
  if (patch.timeline !== undefined) update.timeline = patch.timeline;
  if (patch.targetKobo !== undefined) update.target_kobo = patch.targetKobo;
  if (patch.profitSplitInvestorBps !== undefined)
    update.profit_split_investor_bps = patch.profitSplitInvestorBps;
  if (patch.exitNoticeDays !== undefined) update.exit_notice_days = patch.exitNoticeDays;
  if (patch.earlyExitPenaltyBps !== undefined)
    update.early_exit_penalty_bps = patch.earlyExitPenaltyBps;
  if (patch.payAccount !== undefined) update.pay_account = patch.payAccount;

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .select(PROJECT_COLUMNS)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProject(data);
}

export async function decideProject(id: string, approvalStatus: ApprovalStatus): Promise<Project> {
  if (approvalStatus !== 'APPROVED' && approvalStatus !== 'REJECTED') {
    throw normalizeError(new Error('Invalid approval status'));
  }
  try {
    await invokeApproveProject(id, approvalStatus);
  } catch (error) {
    throw normalizeError(error);
  }

  const project = await fetchProjectById(id);
  if (!project) throw normalizeError(new Error('Project not found after approval'));
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw normalizeError(error);
}
