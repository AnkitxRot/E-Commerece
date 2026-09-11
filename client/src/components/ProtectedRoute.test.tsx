import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Role } from '@audio-commerce/shared';
import { ProtectedRoute } from './ProtectedRoute.js';
import * as AuthContext from '../context/AuthContext.js';

function renderWithAuth(authValue: Partial<ReturnType<typeof AuthContext.useAuth>>, initialPath = '/account') {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue(authValue as ReturnType<typeof AuthContext.useAuth>);
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/account" element={<div>Account page</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth status is loading', () => {
    renderWithAuth({ status: 'loading', user: null });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the child route when authenticated', () => {
    renderWithAuth({ status: 'authenticated', user: { id: '1', email: 'a@b.com', name: 'A', role: Role.CUSTOMER } });
    expect(screen.getByText('Account page')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderWithAuth({ status: 'unauthenticated', user: null });
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('redirects a CUSTOMER away from an ADMIN-only route', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      status: 'authenticated',
      user: { id: '1', email: 'a@b.com', name: 'A', role: Role.CUSTOMER },
    } as ReturnType<typeof AuthContext.useAuth>);
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<ProtectedRoute role={Role.ADMIN} />}>
            <Route path="/admin" element={<div>Admin page</div>} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
