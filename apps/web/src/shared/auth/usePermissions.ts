import { getCurrentUser } from '@api/auth';
import { hasPermission, type Permission } from './permissions';

// Reads the authenticated user's roles from the existing session source and exposes a `can()` helper
// for hiding/disabling actions. UX-only: the API still enforces every write server-side.
export function usePermissions() {
  const roles = getCurrentUser()?.roles ?? [];

  return {
    roles,
    can: (permission: Permission) => hasPermission(roles, permission),
  };
}
