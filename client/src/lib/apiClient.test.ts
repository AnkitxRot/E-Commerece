import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, setAccessToken, refreshAccessToken, ApiError } from './apiClient.js';

describe('apiFetch', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('attaches the in-memory access token as a Bearer header', async () => {
    setAccessToken('token-123');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await apiFetch('/api/auth/me');
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });

  it('throws ApiError with the server-provided code and message on failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'missing' } }), { status: 404 }),
    );
    await expect(apiFetch('/api/whatever')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'missing',
    });
  });

  it('retries once after a successful silent refresh on a 401', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'expired' } }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'new-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: '1' } }), { status: 200 }));

    const result = await apiFetch<{ user: { id: string } }>('/api/auth/me');
    expect(result.user.id).toBe('1');
    expect(fetchMock).toHaveBeenCalledTimes(3); // original, refresh, retry
  });

  it.each(['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'])(
    'does not attempt refresh when %s itself fails with 401',
    async (path) => {
      const fetchMock = fetch as ReturnType<typeof vi.fn>;
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'nope' } }), { status: 401 }),
      );
      await expect(apiFetch(path, { method: 'POST' })).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('shares exactly one in-flight refresh across concurrent 401s', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const unauthorized = () =>
      Promise.resolve(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'expired' } }), { status: 401 }));
    const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

    // Each protected path returns 401 exactly once, then succeeds — models a
    // genuinely expired access token that a single refresh should fix for both.
    let protectedACalls = 0;
    let protectedBCalls = 0;
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/protected-a') return ++protectedACalls === 1 ? unauthorized() : ok({ from: 'a' });
      if (path === '/api/protected-b') return ++protectedBCalls === 1 ? unauthorized() : ok({ from: 'b' });
      if (path === '/api/auth/refresh') return ok({ accessToken: 'new-token' });
      throw new Error(`unexpected path in test: ${path}`);
    });

    const [a, b] = await Promise.all([apiFetch('/api/protected-a'), apiFetch('/api/protected-b')]);
    expect(a).toEqual({ from: 'a' });
    expect(b).toEqual({ from: 'b' });

    const refreshCalls = fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('refreshAccessToken() itself is single-flight when called concurrently', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ accessToken: 'tok' }), { status: 200 }));

    const [a, b] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(a).toBe('tok');
    expect(b).toBe('tok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('failed refresh rejects waiting requests and clears the in-memory access token', async () => {
    setAccessToken('stale-token');
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((path: string) => {
      if (path === '/api/protected-a' || path === '/api/protected-b') {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'expired' } }), { status: 401 }),
        );
      }
      if (path === '/api/auth/refresh') {
        return Promise.resolve(
          new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'reuse' } }), { status: 401 }),
        );
      }
      throw new Error(`unexpected path in test: ${path}`);
    });

    const [a, b] = await Promise.allSettled([apiFetch('/api/protected-a'), apiFetch('/api/protected-b')]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');
    expect((a as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
    expect((b as PromiseRejectedResult).reason).toBeInstanceOf(ApiError);
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);

    fetchMock.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/api/after') {
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      throw new Error(`unexpected path in test: ${path}`);
    });
    await apiFetch('/api/after');
  });
});
