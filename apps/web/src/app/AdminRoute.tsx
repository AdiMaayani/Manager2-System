import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '@api/auth';

interface AdminRouteProps {
  children: ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const user = getCurrentUser();
  const canAccessAdmin = user?.roles.includes('Admin') ?? false;

  return canAccessAdmin ? children : <Navigate to="/" replace />;
}
