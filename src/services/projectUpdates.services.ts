import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import type { ProjectUpdate, ProjectUpdateKind } from '@/src/types/projectUpdate.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb: any = supabase;

const MISSING_SCHEMA_CODES = new Set([
  '42P01',
  '42703',
  'PGRST202',
  'PGRST204',
  'PGRST205',
]);

function isMissingSchema(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: string }).code;
  return !!code && MISSING_SCHEMA_CODES.has(code);
}

function mapRow(row: any): ProjectUpdate {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind as ProjectUpdateKind,
    title: row.title,
    body: row.body ?? '',
    amountMinor: row.amount_minor ?? undefined,
    postedBy: row.posted_by,
    postedByName: row.profiles?.full_name,
    createdAt: row.created_at,
  };
}

export async function fetchProjectUpdates(
  projectId: string,
  kind?: ProjectUpdateKind,
): Promise<ProjectUpdate[]> {
  if (!projectId) return [];
  let query = sb
    .from('project_updates')
    .select('id, project_id, kind, title, body, amount_minor, posted_by, created_at, profiles:posted_by(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (kind) query = query.eq('kind', kind);

  const { data, error } = await query;
  if (error) {
    if (isMissingSchema(error)) return [];
    throw normalizeError(error);
  }
  return (data ?? []).map(mapRow);
}

export type PostUpdateInput = {
  projectId: string;
  kind: ProjectUpdateKind;
  title: string;
  body: string;
  amountMinor?: number;
};

export async function postProjectUpdate(input: PostUpdateInput): Promise<ProjectUpdate> {
  const { data, error } = await sb.rpc('post_project_update', {
    p_project_id: input.projectId,
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body,
    p_amount_minor: input.amountMinor ?? null,
  });

  if (error) throw normalizeError(error);

  const row = Array.isArray(data) ? data[0] : data;
  return mapRow(row);
}
