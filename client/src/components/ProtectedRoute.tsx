import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { LoadingState } from './LoadingState.js';
import type { Role } from '@audio-commerce/shared';

export function ProtectedRoute({ role }: { role?: Role }) {
  const { status, user } = useAuth();

  if (status === 'idle' || status === 'loading') return <LoadingState label="Checking your session…" />;
  if (status === 'unauthenticated' || !user) return <Navigate to="/login" replace />;
  // UX-only convenience redirect — the API independently enforces this via requireRole.
  if (role && user.role !== role) return <Navigate to="/login" replace />;

  return <Outlet />;
}
