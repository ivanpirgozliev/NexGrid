import { authStore, type AuthSession } from './authStore';

const API_URL = import.meta.env.VITE_API_URL;

/*
  Reported rather than thrown. This module is part of the synchronous import
  graph behind <App>, so throwing here would run before React mounts and leave a
  blank screen with nothing but a console message — the ErrorBoundary would
  never get the chance to render. App throws this during render instead.

  The wording matters: ErrorBoundary selects its configuration-specific message
  by looking for the phrase "environment variables".
*/
export const apiConfigError: string | null = API_URL
  ? null
  : 'Missing required environment variables: set VITE_API_URL to the NexGrid Worker API URL.';

const BASE = (API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown; message?: unknown };
    if (typeof body.error === 'string' && body.error) return body.error;
    if (typeof body.message === 'string' && body.message) return body.message;
  } catch {
    // Non-JSON error bodies fall through to the status text.
  }
  return res.statusText || `Request failed with ${res.status}`;
}

/*
  Access tokens last an hour, so a long session will hit an expired one. A
  single shared promise means a burst of parallel 401s triggers one refresh
  rather than one per request — and since the API rotates refresh tokens on
  every use, parallel refreshes would invalidate each other.
*/
let inFlightRefresh: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = authStore.getRefreshToken();
  if (!refreshToken) return false;

  inFlightRefresh ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) {
        // The refresh token is spent, revoked, or expired: this session is over.
        authStore.clear();
        return false;
      }

      authStore.set((await res.json()) as AuthSession);
      return true;
    } catch {
      // A network failure is not proof the session is invalid, so the tokens
      // are left in place for the next attempt.
      return false;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Raw binary payload, used for avatar uploads. */
  rawBody?: BodyInit;
  contentType?: string;
  auth?: boolean;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, rawBody, contentType, auth = true } = options;
  const headers: Record<string, string> = {};

  if (rawBody !== undefined && contentType) {
    headers['Content-Type'] = contentType;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = authStore.getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  return fetch(`${BASE}${path}`, {
    method,
    headers,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  let res = await send(path, options);

  if (res.status === 401 && options.auth !== false && authStore.getRefreshToken()) {
    if (await refreshSession()) {
      res = await send(path, options);
    }
  }

  if (!res.ok) {
    throw new ApiError(await readError(res), res.status);
  }

  return res;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return (await request(path)).json() as Promise<T>;
  },

  async post<T>(path: string, body?: unknown, opts?: { auth?: boolean }): Promise<T> {
    const res = await request(path, { method: 'POST', body, auth: opts?.auth });
    return res.status === 204 ? (undefined as T) : (res.json() as Promise<T>);
  },

  async postRaw<T>(path: string, rawBody: BodyInit, contentType: string): Promise<T> {
    const res = await request(path, { method: 'POST', rawBody, contentType });
    return res.json() as Promise<T>;
  },

  async delete(path: string, body?: unknown): Promise<void> {
    await request(path, { method: 'DELETE', body });
  },
};
