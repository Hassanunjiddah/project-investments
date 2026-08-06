import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Session / auth storage. SecureStore works on iOS/Android only — its web
 * stub is an empty object, so setItemAsync throws and sessions never persist
 * (and can leave the SPA stuck on a blank shell after sign-in). Use
 * localStorage on web.
 */
const isWeb = Platform.OS === 'web';

export async function getItem(key: string): Promise<string | null> {
  try {
    if (isWeb) {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      return window.localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (isWeb) {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(key, value);
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
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* best-effort */
  }
}
