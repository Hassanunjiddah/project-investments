import { File } from 'expo-file-system';
import type { ProjectDocument, DocKind } from '@/src/types/document.types';
import { supabase } from '@/src/services/supabase';
import { normalizeError, AppError } from '@/src/helpers/supabaseError';
import { Platform } from 'react-native';

const BUCKET = 'project-documents';

function generateStorageKey(): string {
  // Simple RFC4122 version 4 compliant UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
  amount_minor: number | null;
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
    amountMinor: row.amount_minor ?? undefined,
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
  amountMinor?: number;
};

export async function uploadProjectDocument(input: UploadDocumentInput): Promise<ProjectDocument> {
  const storagePath = `${input.projectId}/${generateStorageKey()}/${input.fileName}`;

  let bytes: ArrayBuffer;

  if (Platform.OS === 'web') {
    const response = await fetch(input.uri);
    const blob = await response.blob();
    bytes = await blob.arrayBuffer();
  } else {
    bytes = await new File(input.uri).arrayBuffer();
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: input.mimeType, upsert: false });

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
      amount_minor: input.amountMinor ?? null,
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

/**
 * "Adopt" a file that was already uploaded to Supabase Storage (typically
 * from the wizard's `inbox/` prefix by the brief extractor) and attach it
 * to a project. Uses `storage.move()` to relocate it in-place — no
 * download + re-upload — then inserts the `project_docs` row.
 *
 * Best-effort rollback: if the DB insert fails, we attempt to move the
 * file back to its original path so the inbox stays clean.
 */
export async function attachStorageDocument(input: {
  projectId: string;
  userId: string;
  sourceBucket: string;
  sourcePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: DocKind;
  title: string;
  note?: string;
}): Promise<ProjectDocument> {
  const destPath = `${input.projectId}/${generateStorageKey()}/${input.fileName}`;

  // Only same-bucket moves are supported by the storage API. Since the
  // brief inbox lives in `project-documents`, this always matches.
  if (input.sourceBucket !== BUCKET) {
    throw new AppError(
      `Cannot adopt file from bucket '${input.sourceBucket}' — expected '${BUCKET}'.`,
    );
  }

  const { error: moveError } = await supabase.storage
    .from(BUCKET)
    .move(input.sourcePath, destPath);
  if (moveError) throw normalizeError(moveError);

  const { data, error } = await supabase
    .from('project_docs')
    .insert({
      project_id: input.projectId,
      kind: input.kind,
      title: input.title,
      file_name: input.fileName,
      storage_path: destPath,
      mime_type: input.mimeType,
      file_size_bytes: input.sizeBytes,
      note: input.note ?? null,
      uploaded_by: input.userId,
    })
    .select('*')
    .single();

  if (error) {
    // Best-effort: put the file back where we found it so the next attempt
    // can retry cleanly.
    await supabase.storage.from(BUCKET).move(destPath, input.sourcePath).catch(() => {});
    throw normalizeError(error);
  }
  return mapRowToDocument(data);
}
