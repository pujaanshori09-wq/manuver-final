import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the Manuver API lives.
 *
 * - Production / explicit: EXPO_PUBLIC_API_URL (e.g. https://api.manuver.app).
 * - Development: the same host that serves the JS bundle (Metro). metro.config.js
 *   proxies /v1 and /uploads to the local API on port 4000, so this works on the web,
 *   over LAN, and through the Expo tunnel without a second tunnel.
 */
export function getApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.5:8082" or "abc-8082.exp.direct"
  if (hostUri) {
    const host = hostUri.split('/')[0]!;
    const secure = /\.(exp\.direct|ngrok\.io|ngrok-free\.app|ngrok\.app)$/.test(host.split(':')[0]!);
    return `${secure ? 'https' : 'http'}://${host}`;
  }

  return 'http://localhost:4000';
}

/** Server returns photo paths like "/uploads/users/…jpg"; make them absolute for <Image>. */
export function assetUrl(pathOrUrl: string | null | undefined): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${getApiBaseUrl()}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}
