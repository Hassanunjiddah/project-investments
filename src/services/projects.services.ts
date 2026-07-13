import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ApprovalStatus,
  PayAccount,
  DurationUnit,
} from '@/src/types/project.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import type { Database, Json } from '@/src/types/supabase.types';
import { invokeApproveProject } from '@/src/services/edgeFunctions.services';

const PROJECT_COLUMNS =
  'id, code, name, sector, location, summary, full_details, risks, timeline, pay_account, banner_storage_path, banner_mime_type, stage, approval_status, currency_code, target_minor, raised_minor, estimated_roi_bps, duration_value, duration_unit, is_public, submitted_at, profit_split_investor_bps, exit_notice_days, early_exit_penalty_bps, created_by, approved_by, approved_at, rejected_by, rejected_at, rejection_note, created_at';

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

function getProjectBannerUrl(storagePath: string | null): string | undefined {
  if (!storagePath) return undefined;

  const { data } = supabase.storage.from('project-banners').getPublicUrl(storagePath);
  return data.publicUrl;
}

function mapRowToProject(row: {
  id: string;
  code: string;
  name: string;
  sector: string;
  location: string;
  summary: string;
  full_details: string;
  risks: string;
  timeline: string;
  pay_account: Json | null;
  banner_storage_path: string | null;
  banner_mime_type: string | null;
  stage: string;
  approval_status: string;
  currency_code: string;
  target_minor: number;
  raised_minor: number;
  estimated_roi_bps: number;
  duration_value: number;
  duration_unit: string;
  is_public: boolean;
  submitted_at: string | null;
  profit_split_investor_bps: number;
  exit_notice_days: number;
  early_exit_penalty_bps: number;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_note: string | null;
  created_at?: string;
}): Project {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sector: row.sector,
    location: row.location,
    summary: row.summary,
    fullDetails: row.full_details,
    risks: row.risks,
    timeline: row.timeline,
    payAccount: mapPayAccount(row.pay_account),
    bannerStoragePath: row.banner_storage_path ?? undefined,
    bannerMimeType: row.banner_mime_type ?? undefined,
    bannerUrl: getProjectBannerUrl(row.banner_storage_path),
    stage: row.stage as Project['stage'],
    approvalStatus: row.approval_status as Project['approvalStatus'],
    currencyCode: row.currency_code,
    targetMinor: row.target_minor,
    raisedMinor: row.raised_minor,
    estimatedRoiBps: row.estimated_roi_bps,
    durationValue: row.duration_value,
    durationUnit: row.duration_unit as DurationUnit,
    isPublic: row.is_public,
    submittedAt: row.submitted_at ?? undefined,
    profitSplitInvestorBps: row.profit_split_investor_bps,
    exitNoticeDays: row.exit_notice_days,
    earlyExitPenaltyBps: row.early_exit_penalty_bps,
    createdBy: row.created_by,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectedBy: row.rejected_by ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    rejectionNote: row.rejection_note ?? undefined,
    createdAt: row.created_at,
    targetKobo: row.target_minor,
    raisedKobo: row.raised_minor,
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
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false });

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
      target_minor: input.targetMinor,
      duration_value: input.durationValue,
      duration_unit: input.durationUnit,
      estimated_roi_bps: input.estimatedRoiBps ?? 0,
      is_public: input.isPublic ?? false,
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
  if (patch.targetMinor !== undefined) update.target_minor = patch.targetMinor;
  if (patch.durationValue !== undefined) update.duration_value = patch.durationValue;
  if (patch.durationUnit !== undefined) update.duration_unit = patch.durationUnit;
  if (patch.estimatedRoiBps !== undefined) update.estimated_roi_bps = patch.estimatedRoiBps;
  if (patch.isPublic !== undefined) update.is_public = patch.isPublic;
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

export async function decideProject(
  id: string,
  approvalStatus: ApprovalStatus,
  rejectionNote?: string,
): Promise<Project> {
  if (approvalStatus !== 'APPROVED' && approvalStatus !== 'REJECTED') {
    throw normalizeError(new Error('Invalid approval status'));
  }
  try {
    await invokeApproveProject(id, approvalStatus, rejectionNote);
  } catch (error) {
    throw normalizeError(error);
  }

  return fetchProjectById(id);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw normalizeError(error);
}
