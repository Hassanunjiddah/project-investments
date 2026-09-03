import type { DocKind } from '@/src/types/document.types';
import { supabase } from '@/src/services/supabase';
import { AppError, normalizeError } from '@/src/helpers/supabaseError';

export type DocumentRequestStatus = 'PENDING' | 'FULFILLED' | 'CANCELLED';

export type DocumentRequest = {
  id: string;
  projectId: string;
  requestedBy: string;
  assigneeId: string;
  docKind: DocKind;
  title: string;
  note?: string;
  status: DocumentRequestStatus;
  fulfilledDocId?: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  createdAt: string;
};

function mapRow(row: {
  id: string;
  project_id: string;
  requested_by: string;
  assignee_id: string;
  doc_kind: string;
  title: string;
  note: string | null;
  status: string;
  fulfilled_doc_id: string | null;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}): DocumentRequest {
  return {
    id: row.id,
    projectId: row.project_id,
    requestedBy: row.requested_by,
    assigneeId: row.assignee_id,
    docKind: row.doc_kind as DocKind,
    title: row.title,
    note: row.note ?? undefined,
    status: row.status as DocumentRequestStatus,
    fulfilledDocId: row.fulfilled_doc_id ?? undefined,
    fulfilledAt: row.fulfilled_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listDocumentRequests(projectId: string): Promise<DocumentRequest[]> {
  const { data, error } = await supabase.rpc('list_document_requests', {
    p_project_id: projectId,
  });
  if (error) throw normalizeError(error);
  return (data ?? []).map(mapRow);
}

export async function requestProjectDocument(input: {
  projectId: string;
  kind: DocKind;
  title: string;
  note?: string;
}): Promise<DocumentRequest> {
  const { data, error } = await supabase.rpc('request_project_document', {
    p_project_id: input.projectId,
    p_kind: input.kind,
    p_title: input.title,
    p_note: input.note ?? null,
  });
  if (error) throw normalizeError(error);
  if (!data) throw new AppError('Failed to create document request');
  return mapRow(data as Parameters<typeof mapRow>[0]);
}

export async function fulfillDocumentRequest(
  requestId: string,
  docId: string,
): Promise<DocumentRequest> {
  const { data, error } = await supabase.rpc('fulfill_document_request', {
    p_request_id: requestId,
    p_doc_id: docId,
  });
  if (error) throw normalizeError(error);
  if (!data) throw new AppError('Failed to fulfill document request');
  return mapRow(data as Parameters<typeof mapRow>[0]);
}

export async function cancelDocumentRequest(requestId: string): Promise<DocumentRequest> {
  const { data, error } = await supabase.rpc('cancel_document_request', {
    p_request_id: requestId,
  });
  if (error) throw normalizeError(error);
  if (!data) throw new AppError('Failed to cancel document request');
  return mapRow(data as Parameters<typeof mapRow>[0]);
}
