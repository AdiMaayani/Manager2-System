import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '@api/auth';
import { hasPermission, type Permission } from '@shared/auth/permissions';

interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

// Route guard: renders children only when the current user's roles grant the permission,
// otherwise redirects to the dashboard. Mirrors AdminRoute but is permission-driven.
export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const user = getCurrentUser();
  const isAllowed = hasPermission(user?.roles ?? [], permission);

  return isAllowed ? <>{children}</> : <Navigate to="/" replace />;
}
