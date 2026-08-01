/**
 * In-memory cache for the wizard project brief.
 *
 * The Upload step stores the file in `inbox/` for Gemini extraction and keeps
 * a `supabase-storage://…` URI in the persisted draft. If an earlier create
 * attempt moved/deleted that inbox object, submit fails with "Object not found".
 *
 * We keep the raw bytes for the session so submit can re-upload straight into
 * the new project folder without depending on the inbox object still existing.
 */

export type CachedBrief = {
  bytes: ArrayBuffer;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
};

const cache = new Map<string, CachedBrief>();

export function putBriefCache(key: string, entry: CachedBrief): void {
  cache.set(key, entry);
}

export function getBriefCache(key: string | undefined | null): CachedBrief | null {
  if (!key) return null;
  return cache.get(key) ?? null;
}

export function clearBriefCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
