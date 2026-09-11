export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Endpoints whose own 401 must never trigger an automatic refresh-and-retry:
// a failed login/register attempt is a normal rejected credential, not an
// expired session; a failed refresh/logout must not recursively try to
// refresh itself.
const NEVER_AUTO_REFRESH = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']);

async function rawFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Request failed' } }));
    throw new ApiError(res.status, body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'Request failed');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Single-flight: refresh tokens rotate on every use, so two concurrent raw
// calls to /api/auth/refresh would race to rotate the same token — the loser
// looks identical to a replay and trips reuse detection. Every caller
// (apiFetch's automatic retry, AuthContext's mount-time check, including its
// duplicate invocation under React StrictMode) goes through this one gate,
// so only one real network call to /api/auth/refresh is ever in flight.
let refreshInFlight: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = rawFetch<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' })
      .then(({ accessToken: newToken }) => {
        setAccessToken(newToken);
        return newToken;
      })
      .catch((err) => {
        setAccessToken(null);
        throw err;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await rawFetch<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !NEVER_AUTO_REFRESH.has(path)) {
      await refreshAccessToken();
      return rawFetch<T>(path, options);
    }
    throw err;
  }
}
