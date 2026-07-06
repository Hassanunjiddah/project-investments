import type { ProjectDocument, DocKind } from '@/src/types/document.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError } from '@/src/helpers/supabaseError';

const BUCKET = 'project-documents';

function generateStorageKey(): string {
  return crypto.randomUUID();
}

function mapRowToDocument(row: {
  id: string;
  project_id: string;
  kind: string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number | null;
  amount_kobo: number | null;
  note: string | null;
  uploaded_by: string;
  created_at: string;
}): ProjectDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind as DocKind,
    title: row.title,
    fileName: row.file_name,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes ?? undefined,
    amountKobo: row.amount_kobo ?? undefined,
    note: row.note ?? undefined,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export type UploadDocumentInput = {
  projectId: string;
  userId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: DocKind;
  title: string;
  note?: string;
  amountKobo?: number;
};

export async function uploadProjectDocument(input: UploadDocumentInput): Promise<ProjectDocument> {
  const storagePath = `${input.projectId}/${generateStorageKey()}/${input.fileName}`;

  const response = await fetch(input.uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: input.mimeType, upsert: false });

  if (uploadError) throw normalizeError(uploadError);

  const { data, error } = await supabase
    .from('project_docs')
    .insert({
      project_id: input.projectId,
      kind: input.kind,
      title: input.title,
      file_name: input.fileName,
      storage_path: storagePath,
      mime_type: input.mimeType,
      file_size_bytes: input.sizeBytes,
      amount_kobo: input.amountKobo ?? null,
      note: input.note ?? null,
      uploaded_by: input.userId,
    })
    .select('*')
    .single();

  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw normalizeError(error);
  }

  return mapRowToDocument(data);
}

export async function fetchDocumentsForProject(projectId: string): Promise<ProjectDocument[]> {
  const { data, error } = await supabase
    .from('project_docs')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw normalizeError(error);
  return (data ?? []).map(mapRowToDocument);
}

export async function deleteProjectDocument(docId: string, storagePath: string): Promise<void> {
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (storageError) throw normalizeError(storageError);

  const { error } = await supabase.from('project_docs').delete().eq('id', docId);
  if (error) throw normalizeError(error);
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);

  if (error) throw normalizeError(error);
  if (!data?.signedUrl) throw normalizeError(new Error('Could not generate document URL'));
  return data.signedUrl;
}
