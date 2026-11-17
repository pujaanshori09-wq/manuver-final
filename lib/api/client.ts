import { getApiBaseUrl } from './config';
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './tokens';

/** Error returned by the API: `code` is stable (map it to translated text), `message` is English. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number };

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Multipart upload (photos). */
  form?: FormData;
  /** Send the access token (default true). */
  auth?: boolean;
  signal?: AbortSignal;
};

// Called when the session can no longer be refreshed (the app returns to sign-in).
const expiredListeners = new Set<() => void>();
export function onSessionExpired(fn: () => void) {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
}

export async function storeTokens(t: TokenPair) {
  setAccessToken(t.accessToken);
  await setRefreshToken(t.refreshToken);
}

/**
 * One refresh at a time: when several requests hit an expired token together, they all
 * wait for the same refresh instead of racing (which would trip the server's reuse detection).
 */
let refreshing: Promise<boolean> | null = null;
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${getApiBaseUrl()}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // Only a definitive rejection ends the session; network trouble keeps the token.
        if (res.status === 401) await clearTokens();
        return false;
      }
      await storeTokens((await res.json()) as TokenPair);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function send(path: string, opts: Options): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getAccessToken();
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  return fetch(`${getApiBaseUrl()}${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.form ? 'POST' : 'GET'),
    headers,
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    signal: opts.signal,
  });
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const json = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    return new ApiError(
      res.status,
      json.error?.code ?? 'http_error',
      json.error?.message ?? `Request failed (${res.status})`,
      json.error?.details as ApiError['details'],
    );
  } catch {
    return new ApiError(res.status, 'http_error', `Request failed (${res.status})`);
  }
}

/** Calls the API; refreshes an expired access token once and retries. */
export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  let res: Response;
  try {
    if (opts.auth !== false && !getAccessToken()) await refreshSession();
    res = await send(path, opts);
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the server');
  }

  if (res.status === 401 && opts.auth !== false) {
    const ok = await refreshSession();
    if (!ok) {
      expiredListeners.forEach((fn) => fn());
      throw await toError(res);
    }
    try {
      res = await send(path, opts);
    } catch {
      throw new ApiError(0, 'network_error', 'Could not reach the server');
    }
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
