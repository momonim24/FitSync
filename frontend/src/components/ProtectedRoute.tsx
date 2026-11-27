import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { Role } from '../api/types';
import { homePath, useAuth } from '../context/AuthContext';
import { LoadingState } from './ui';

/**
 * Client-side route guard: sends guests to /login and users of the wrong
 * role to their own dashboard. This only improves UX — the real security
 * is enforced by the API's JWT and role guards (401/403).
 */
export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to={homePath(user.role)} replace />;
  return <>{children}</>;
}

/** Keeps logged-in users away from the login/register pages. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return null;
  if (user) return <Navigate to={homePath(user.role)} replace />;
  return <>{children}</>;
}
