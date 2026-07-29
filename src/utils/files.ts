import type { DocumentPickerAsset } from 'expo-document-picker';
import type { DocKind } from '@/src/types/document.types';
import type { DraftDocument } from '@/src/store/useProjectDraftStore';

export const BANNER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
];

export const MAX_ATTACHMENTS = 10;

const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  md: 'text/markdown',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Resolves a usable mime type for an upload. Mobile browsers (and some
 * pickers) report DOCX/TXT as `application/octet-stream` or omit the type
 * entirely, which the storage bucket's `allowed_mime_types` rejects — so
 * fall back to the file extension whenever the reported type is unusable.
 */
export function inferMimeType(fileName: string, reported?: string | null): string {
  if (reported && reported !== 'application/octet-stream') return reported;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? reported ?? 'application/octet-stream';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mapPickerAssetToDraft(asset: DocumentPickerAsset, localId: string): DraftDocument {
  return {
    localId,
    uri: asset.uri,
    fileName: asset.name ?? 'document',
    mimeType: asset.mimeType ?? 'application/octet-stream',
    sizeBytes: asset.size ?? 0,
    kind: 'OVERVIEW' as DocKind,
    title: asset.name?.replace(/\.[^.]+$/, '') ?? 'Document',
  };
}

export function generateLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
