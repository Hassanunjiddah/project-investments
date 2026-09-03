import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { loadKeepSignedIn } from '@/src/constants/session';

/**
 * Session / auth storage. SecureStore works on iOS/Android only — its web
 * stub is an empty object, so setItemAsync throws and sessions never persist
 * (and can leave the SPA stuck on a blank shell after sign-in). Use
 * localStorage on web when "Keep me signed in" is on; sessionStorage when
 * the user opts out so closing the tab ends the session.
 */
const isWeb = Platform.OS === 'web';

function webPrimaryStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return loadKeepSignedIn() ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function webOtherStore(primary: Storage): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return primary === window.localStorage ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

export async function getItem(key: string): Promise<string | null> {
  try {
    if (isWeb) {
      const primary = webPrimaryStore();
      if (!primary) return null;
      const fromPrimary = primary.getItem(key);
      if (fromPrimary != null) return fromPrimary;
      // Migration / race: token may still sit in the other store.
      const other = webOtherStore(primary);
      return other?.getItem(key) ?? null;
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      const primary = webPrimaryStore();
      if (!primary) return;
      primary.setItem(key, value);
      const other = webOtherStore(primary);
      try {
        other?.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* best-effort — never block auth on storage failures */
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    if (isWeb) {
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* best-effort */
  }
}
