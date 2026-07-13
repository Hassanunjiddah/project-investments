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
