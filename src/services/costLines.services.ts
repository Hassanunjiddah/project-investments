import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';
import { nairaToKobo } from '@/src/utils/currency';
import type { CostLineFormValues } from '@/src/schemas/costLine.schema';
import type { CostLineClass, CostLineNature } from '@/src/utils/costLineMath';

/** Same bucket as project docs — its RLS already covers <projectId>/… paths. */
const DOC_BUCKET = 'project-documents';

/** Typed after `supabase gen types` lands project_cost_lines. */
const costLines = () => (supabase as any).from('project_cost_lines');

export type { CostLineClass, CostLineNature } from '@/src/utils/costLineMath';
export { summarizeCostLines } from '@/src/utils/costLineMath';

export type ProjectCostLine = {
  id: string;
  projectId: string;
  occurredOn: string;
  description: string;
  class: CostLineClass;
  nature: CostLineNature;
  quantity: number;
  unitCostMinor: number;
  annualFrequency: number;
  totalMinor: number;
  docStoragePath: string | null;
  docFileName: string | null;
  docMimeType: string | null;
  createdBy: string;
  createdAt: string;
};

export type CostLineDoc = {
  storagePath: string;
  fileName: string;
  mimeType: string;
};

type CostLineRow = {
  id: string;
  project_id: string;
  occurred_on: string;
  description: string;
  class: string;
  nature: string;
  quantity: number | string;
  unit_cost_minor: number;
  annual_frequency: number;
  total_minor: number;
  doc_storage_path: string | null;
  doc_file_name: string | null;
  doc_mime_type: string | null;
  created_by: string;
  created_at: string;
};

const COLUMNS =
  'id, project_id, occurred_on, description, class, nature, quantity, unit_cost_minor, annual_frequency, total_minor, doc_storage_path, doc_file_name, doc_mime_type, created_by, created_at';

function mapRow(row: CostLineRow): ProjectCostLine {
  return {
    id: row.id,
    projectId: row.project_id,
    occurredOn: row.occurred_on,
    description: row.description,
    class: row.class as CostLineClass,
    nature: row.nature as CostLineNature,
    quantity: Number(row.quantity),
    unitCostMinor: row.unit_cost_minor,
    annualFrequency: row.annual_frequency,
    totalMinor: row.total_minor,
    docStoragePath: row.doc_storage_path,
    docFileName: row.doc_file_name,
    docMimeType: row.doc_mime_type,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function fetchCostLines(projectId: string): Promise<ProjectCostLine[]> {
  const { data, error } = await costLines()
    .select(COLUMNS)
    .eq('project_id', projectId)
    .order('occurred_on', { ascending: false })
    .limit(500);

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === 'PGRST205' || code === '42P01') return [];
    throw normalizeError(error);
  }
  return (data ?? []).map((row: CostLineRow) => mapRow(row));
}

function formToInsert(projectId: string, userId: string, values: CostLineFormValues) {
  const nature = values.nature;
  const freq = nature === 'ONE_TIME' ? 1 : (values.annualFrequency ?? 1);
  return {
    project_id: projectId,
    occurred_on: values.occurredOn,
    description: values.description.trim(),
    class: values.class,
    nature,
    quantity: values.quantity,
    unit_cost_minor: nairaToKobo(Number(values.unitCostNaira)),
    annual_frequency: freq,
    created_by: userId,
  };
}

/** Upload a receipt/invoice for a cost line and return its storage reference. */
export async function uploadCostLineDoc(
  projectId: string,
  file: { uri: string; name: string; mimeType?: string },
): Promise<CostLineDoc> {
  const key = `${projectId}/costlines/${Date.now()}-${Math.random().toString(36).slice(2, 10)}/${file.name}`;
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

export async function getCostLineDocUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOC_BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) throw normalizeError(error);
  if (!data?.signedUrl) throw normalizeError(new Error('Could not generate document URL'));
  return data.signedUrl;
}

function docToColumns(doc: CostLineDoc | null | undefined) {
  if (doc === undefined) return {};
  return doc === null
    ? { doc_storage_path: null, doc_file_name: null, doc_mime_type: null }
    : {
        doc_storage_path: doc.storagePath,
        doc_file_name: doc.fileName,
        doc_mime_type: doc.mimeType,
      };
}

export async function createCostLine(
  projectId: string,
  userId: string,
  values: CostLineFormValues,
  doc?: CostLineDoc | null,
): Promise<ProjectCostLine> {
  const { data, error } = await costLines()
    .insert({ ...formToInsert(projectId, userId, values), ...docToColumns(doc) })
    .select(COLUMNS)
    .single();
  if (error) throw normalizeError(error);
  return mapRow(data as CostLineRow);
}

export async function updateCostLine(
  id: string,
  values: Partial<CostLineFormValues>,
  doc?: CostLineDoc | null,
): Promise<ProjectCostLine> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (values.occurredOn != null) patch.occurred_on = values.occurredOn;
  if (values.description != null) patch.description = values.description.trim();
  if (values.class != null) patch.class = values.class;
  if (values.nature != null) patch.nature = values.nature;
  if (values.quantity != null) patch.quantity = values.quantity;
  if (values.unitCostNaira != null) patch.unit_cost_minor = nairaToKobo(Number(values.unitCostNaira));
  if (values.annualFrequency != null || values.nature === 'ONE_TIME') {
    patch.annual_frequency = values.nature === 'ONE_TIME' ? 1 : (values.annualFrequency ?? 1);
  }
  Object.assign(patch, docToColumns(doc));
  const { data, error } = await costLines()
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw normalizeError(error);
  return mapRow(data as CostLineRow);
}

export async function deleteCostLine(id: string): Promise<void> {
  const { error } = await costLines().delete().eq('id', id);
  if (error) throw normalizeError(error);
}
