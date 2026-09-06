import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ApprovalStatus,
  PayAccount,
  DurationUnit,
  ProfitDeclarationFrequency,
} from '@/src/types/project.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import type { Database, Json } from '@/src/types/supabase.types';
import { invokeApproveProject } from '@/src/services/edgeFunctions.services';
import { getProjectBannerUrl } from '@/src/services/banner.services';

type ListResponse<T> = {
  data: T[];
  count: number;
  fetched: number;
  hasMore: boolean;
};

const PROJECT_COLUMNS =
  'id, code, name, sector, location, summary, full_details, risks, timeline, pay_account, banner_storage_path, banner_mime_type, stage, currency_code, target_minor, raised_minor, drawn_minor, raise_fee_bps, raise_fee_minor, realised_profit_minor, estimated_roi_bps, duration_value, duration_unit, profit_declaration_frequency, is_public, profit_split_investor_bps, exit_notice_days, early_exit_penalty_bps, created_at, total_units, min_units_per_investor, platform_fee_bps, pledge_expiry_hours, project_owner_id';

const LIST_PROJECT_COLUMNS =
  'id, code, name, sector, location, summary, banner_storage_path, banner_mime_type, stage, currency_code, target_minor, raised_minor, drawn_minor, raise_fee_bps, raise_fee_minor, realised_profit_minor, estimated_roi_bps, duration_value, duration_unit, profit_declaration_frequency, is_public, profit_split_investor_bps, exit_notice_days, early_exit_penalty_bps, created_at, total_units, min_units_per_investor, platform_fee_bps, pledge_expiry_hours, project_owner_id, submitted_at, created_by:profiles!created_by(id, full_name), project_owner:profiles!project_owner_id(id, full_name, email), approval_status, approved_by:profiles!approved_by(id, full_name), approved_at, rejected_by:profiles!rejected_by(id, full_name), rejected_at, rejection_note';

const FULL_PROJECT_COLUMNS = `${PROJECT_COLUMNS}, submitted_at, created_by:profiles!created_by(id, full_name), project_owner:profiles!project_owner_id(id, full_name, email), approval_status, approved_by:profiles!approved_by(id, full_name), approved_at, rejected_by:profiles!rejected_by(id, full_name), rejected_at, rejection_note`;

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
  code: string;
  name: string;
  sector: string;
  location: string;
  summary: string;
  full_details?: string;
  risks?: string;
  timeline?: string;
  pay_account?: Json | null;
  banner_storage_path: string | null;
  banner_mime_type: string | null;
  stage: string;
  approval_status: string;
  currency_code: string;
  target_minor: number;
  raised_minor: number;
  drawn_minor?: number | null;
  raise_fee_bps?: number | null;
  raise_fee_minor?: number | null;
  realised_profit_minor: number | null;
  estimated_roi_bps: number;
  duration_value: number;
  duration_unit: string;
  profit_declaration_frequency?: string | null;
  is_public: boolean;
  submitted_at: string | null;
  profit_split_investor_bps: number;
  exit_notice_days: number;
  early_exit_penalty_bps: number;
  created_by: { id: string; full_name: string };
  project_owner_id?: string | null;
  project_owner?: { id: string; full_name: string; email?: string | null } | null;
  approved_by: { id: string; full_name: string } | null;
  approved_at: string | null;
  rejected_by: { id: string; full_name: string } | null;
  rejected_at: string | null;
  rejection_note: string | null;
  created_at?: string;
  total_units?: number | null;
  min_units_per_investor?: number | null;
  platform_fee_bps?: number | null;
  pledge_expiry_hours?: number | null;
}): Project {
  const totalUnits = row.total_units ?? undefined;
  const unitPrice =
    totalUnits && totalUnits > 0 ? Math.floor(row.target_minor / totalUnits) : undefined;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sector: row.sector,
    location: row.location,
    summary: row.summary,
    fullDetails: row.full_details ?? '',
    risks: row.risks ?? '',
    timeline: row.timeline ?? '',
    payAccount: mapPayAccount(row.pay_account ?? null),
    bannerStoragePath: row.banner_storage_path ?? undefined,
    bannerMimeType: row.banner_mime_type ?? undefined,
    bannerUrl: getProjectBannerUrl(row.banner_storage_path),
    stage: row.stage as Project['stage'],
    approvalStatus: row.approval_status as Project['approvalStatus'],
    currencyCode: row.currency_code,
    targetMinor: row.target_minor,
    raisedMinor: row.raised_minor,
    drawnMinor: row.drawn_minor ?? 0,
    raiseFeeBps: row.raise_fee_bps ?? undefined,
    raiseFeeMinor: row.raise_fee_minor ?? 0,
    realisedProfitMinor: row.realised_profit_minor ?? 0,
    estimatedRoiBps: row.estimated_roi_bps,
    durationValue: row.duration_value,
    durationUnit: row.duration_unit as DurationUnit,
    profitDeclarationFrequency: (row.profit_declaration_frequency ??
      'MONTHLY') as ProfitDeclarationFrequency,
    isPublic: row.is_public,
    submittedAt: row.submitted_at ?? undefined,
    profitSplitInvestorBps: row.profit_split_investor_bps,
    exitNoticeDays: row.exit_notice_days,
    earlyExitPenaltyBps: row.early_exit_penalty_bps,
    createdBy: row.created_by,
    projectOwnerId: row.project_owner_id ?? row.project_owner?.id ?? undefined,
    projectOwner: row.project_owner ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectedBy: row.rejected_by ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
    rejectionNote: row.rejection_note ?? undefined,
    createdAt: row.created_at,
    totalUnits,
    unitPriceMinor: unitPrice,
    minUnitsPerInvestor: row.min_units_per_investor ?? undefined,
    platformFeeBps: row.platform_fee_bps ?? undefined,
    pledgeExpiryHours: row.pledge_expiry_hours ?? undefined,
    targetKobo: row.target_minor,
    raisedKobo: row.raised_minor,
  };
}

export async function fetchProjects(props?: {
  status?: ApprovalStatus;
  skip?: number;
  limit?: number;
  orderBy?: 'created_at' | 'submitted_at';
  orderDirection?: 'asc' | 'desc';
  /** When set, only projects this originator owns (PROJECT_OWNER scope). */
  ownerId?: string;
}): Promise<ListResponse<Project>> {
  const skip = props?.skip ?? 0;
  const limit = props?.limit ?? 100;
  const to = skip + limit - 1;
  const query = supabase
    .from('projects')
    .select(LIST_PROJECT_COLUMNS, { count: 'exact' })
    .range(skip, to);
  if (props?.ownerId) {
    query.eq('project_owner_id', props.ownerId);
  }
  if (props?.status) {
    query.eq('approval_status', props.status);
    query.order(props.orderBy ?? 'submitted_at', {
      ascending: (props.orderDirection ?? 'desc') === 'asc',
    });
  } else {
    query.neq('approval_status', 'REJECTED');
    query.order(props?.orderBy ?? 'updated_at', {
      ascending: props?.orderDirection === 'asc',
    });
  }

  const { data, error, count } = await query;

  if (error) throw normalizeError(error);
  return {
    data: (data ?? []).map((row) => mapRowToProject(row as any)),
    count: count ?? 0, // total available matching filters
    fetched: data?.length ?? 0,
    hasMore: skip + limit < (count ?? 0),
  };
}

export async function fetchPendingProjects() {
  return fetchProjects({ status: 'PENDING' });
}

export async function fetchProjectById(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select(FULL_PROJECT_COLUMNS)
    .eq('id', id)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProject(data as any);
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
      // Prism unit-model — cast to any: columns not in generated types yet.
      ...({
        total_units: input.totalUnits ?? null,
        min_units_per_investor: input.minUnitsPerInvestor ?? 1,
        platform_fee_bps: input.platformFeeBps ?? 750,
        raise_fee_bps: input.raiseFeeBps ?? 250,
        profit_declaration_frequency: input.profitDeclarationFrequency ?? 'MONTHLY',
      } as Record<string, unknown>),
    })
    .select(FULL_PROJECT_COLUMNS)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProject(data as any);
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
  if (patch.totalUnits !== undefined) (update as any).total_units = patch.totalUnits;
  if (patch.minUnitsPerInvestor !== undefined)
    (update as any).min_units_per_investor = patch.minUnitsPerInvestor;
  if (patch.platformFeeBps !== undefined) (update as any).platform_fee_bps = patch.platformFeeBps;
  if (patch.raiseFeeBps !== undefined) (update as any).raise_fee_bps = patch.raiseFeeBps;
  if (patch.profitDeclarationFrequency !== undefined)
    (update as any).profit_declaration_frequency = patch.profitDeclarationFrequency;

  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .select(FULL_PROJECT_COLUMNS)
    .single();

  if (error) throw normalizeError(error);
  return mapRowToProject(data as any);
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
