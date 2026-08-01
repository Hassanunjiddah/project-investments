/**
 * In-memory cache for wizard banner bytes.
 *
 * On web, ImagePicker returns `blob:` URLs that die after a refresh (or when
 * the picker revokes them after `allowsEditing`). The draft store persists the
 * URI to AsyncStorage, so submit then does `fetch(blob:…)` → "Failed to fetch".
 *
 * We read the bytes once at pick-time and keep them here for the session so
 * upload never depends on the URI still being alive.
 */

export type CachedBanner = {
  bytes: ArrayBuffer;
  mimeType: string;
  fileName: string;
};

const cache = new Map<string, CachedBanner>();

export function putBannerCache(key: string, entry: CachedBanner): void {
  cache.set(key, entry);
}

export function getBannerCache(key: string | undefined | null): CachedBanner | null {
  if (!key) return null;
  return cache.get(key) ?? null;
}

export function clearBannerCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

export function isEphemeralFileUri(uri: string | undefined | null): boolean {
  if (!uri) return false;
  return (
    uri.startsWith('blob:') ||
    uri.startsWith('data:') ||
    // Some web pickers hand back short-lived object URLs under this scheme.
    uri.startsWith('filesystem:')
  );
}
