import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The refresh token is long-lived, so it lives in the device keychain/keystore
 * (expo-secure-store). The access token is short-lived and only kept in memory.
 * On the web there is no secure store; localStorage is the fallback (dev only).
 */
const KEY = 'manuver.refreshToken';

let accessToken: string | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};

export async function getRefreshToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (token) globalThis.localStorage?.setItem(KEY, token);
      else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Storage unavailable: the session simply won't survive an app restart.
  }
}

export async function clearTokens() {
  accessToken = null;
  await setRefreshToken(null);
}
