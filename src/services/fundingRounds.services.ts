import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

/** Typed after `supabase gen types` lands funding_rounds. */
const db = supabase as any;

/** Same bucket as project docs — its RLS already covers <projectId>/… paths. */
const DOC_BUCKET = 'project-documents';

export type FundingRoundStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type FundingRoundDoc = {
  storagePath: string;
  fileName: string;
  mimeType: string;
};

export type FundingRound = {
  id: string;
  projectId: string;
  additionalUnits: number;
  additionalMinor: number;
  unitPriceMinor: number;
  reason: string;
  costLineIds: string[];
  status: FundingRoundStatus;
  requestedBy: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  docStoragePath: string | null;
  docFileName: string | null;
  docMimeType: string | null;
  createdAt: string;
};

type RoundRow = {
  id: string;
  project_id: string;
  additional_units: number;
  additional_minor: number;
  unit_price_minor: number;
  reason: string;
  cost_line_ids: string[] | null;
  status: string;
  requested_by: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  doc_storage_path: string | null;
  doc_file_name: string | null;
  doc_mime_type: string | null;
  created_at: string;
};

const COLUMNS =
  'id, project_id, additional_units, additional_minor, unit_price_minor, reason, cost_line_ids, status, requested_by, decided_by, decided_at, decision_note, doc_storage_path, doc_file_name, doc_mime_type, created_at';

function isMissingRelation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code === 'PGRST202' || code === 'PGRST205' || code === '42P01' || code === '42883';
}

function mapRow(row: RoundRow): FundingRound {
  return {
    id: row.id,
    projectId: row.project_id,
    additionalUnits: row.additional_units,
    additionalMinor: row.additional_minor,
    unitPriceMinor: row.unit_price_minor,
    reason: row.reason,
    costLineIds: row.cost_line_ids ?? [],
    status: row.status as FundingRoundStatus,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionNote: row.decision_note ?? undefined,
    docStoragePath: row.doc_storage_path ?? null,
    docFileName: row.doc_file_name ?? null,
    docMimeType: row.doc_mime_type ?? null,
    createdAt: row.created_at,
  };
}

/** Upload a supporting document (quote / budget) for a capital raise. */
export async function uploadRoundDoc(
  projectId: string,
  file: { uri: string; name: string; mimeType?: string },
): Promise<FundingRoundDoc> {
  const key = `${projectId}/rounds/${Date.now()}-${Math.random().toString(36).slice(2, 10)}/${file.name}`;
  const mimeType = file.mimeType ?? 'application/octet-stream';

  let bytes: ArrayBuffer;
  if (Platform.OS === 'web') {
    const response = await fetch(file.uri);
    const blob = await response.blob();
    bytes = await blob.arrayBuffer();
  } else {
    bytes = await new File(file.uri).arrayBuffer();
  }

  const { error } = await supabase.storage
    .from(DOC_BUCKET)
    .upload(key, bytes, { contentType: mimeType, upsert: false });
  if (error) throw normalizeError(error);

  return { storagePath: key, fileName: file.name, mimeType };
}

export async function getRoundDocUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) throw normalizeError(error);
  if (!data?.signedUrl) throw normalizeError(new Error('Could not generate document URL'));
  return data.signedUrl;
}

export async function fetchFundingRounds(projectId: string): Promise<FundingRound[]> {
  const { data, error } = await db
    .from('funding_rounds')
    .select(COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (isMissingRelation(error)) return [];
    throw normalizeError(error);
  }
  return (data ?? []).map((row: RoundRow) => mapRow(row));
}

export async function fetchPendingFundingRounds(): Promise<FundingRound[]> {
  const { data, error } = await db.rpc('list_pending_funding_rounds');
  if (error) {
    if (isMissingRelation(error)) return [];
    throw normalizeError(error);
  }
  return (data ?? []).map((row: RoundRow) => mapRow(row));
}

export async function requestFundingRound(input: {
  projectId: string;
  additionalUnits: number;
  reason: string;
  costLineIds?: string[];
  doc?: FundingRoundDoc | null;
}): Promise<FundingRound> {
  const { data, error } = await db.rpc('request_funding_round', {
    p_project_id: input.projectId,
    p_additional_units: input.additionalUnits,
    p_reason: input.reason,
    p_cost_line_ids: input.costLineIds ?? [],
    p_doc_storage_path: input.doc?.storagePath ?? null,
    p_doc_file_name: input.doc?.fileName ?? null,
    p_doc_mime_type: input.doc?.mimeType ?? null,
  });
  if (error) throw normalizeError(error);
  return mapRow(data as RoundRow);
}

export async function decideFundingRound(input: {
  roundId: string;
  status: 'APPROVED' | 'REJECTED';
  note?: string;
}): Promise<FundingRound> {
  const { data, error } = await db.rpc('decide_funding_round', {
    p_round_id: input.roundId,
    p_status: input.status,
    p_note: input.note ?? null,
  });
  if (error) throw normalizeError(error);
  return mapRow(data as RoundRow);
}
