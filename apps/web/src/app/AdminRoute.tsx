import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '@api/auth';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const user = getCurrentUser();
  // Guard against a corrupt/legacy session object where `roles` is missing —
  // `(user?.roles).includes(...)` would throw and crash the whole route tree.
  const canAccessAdmin = (user?.roles ?? []).includes('Admin');

  return canAccessAdmin ? children : <Navigate to="/" replace />;
}
