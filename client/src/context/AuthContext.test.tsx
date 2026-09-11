import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext.js';

function Probe() {
  const { status, user } = useAuth();
  return <div data-testid="status">{status}:{user?.email ?? 'none'}</div>;
}

describe('AuthProvider initialization', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('issues exactly one refresh call even under StrictMode double-invoked effects', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'tok' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user: { id: '1', email: 'a@b.com', name: 'A', role: 'CUSTOMER' } }),
          { status: 200 },
        ),
      );

    render(
      <StrictMode>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </StrictMode>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated:a@b.com'));

    const refreshCalls = fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
  });

  it('settles to unauthenticated when there is no valid session', async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'no cookie' } }), { status: 401 }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated:none'));
  });
});
