import { describe, expect, it } from 'vitest';
import { hasPermission, ROLES } from './permissions';

// Mirrors ManageR2.Api AuthorizationPolicies CanManageSites role set.
const CAN_MANAGE_SITES_ROLES = [
  ROLES.Admin,
  ROLES.SeniorManagement,
  ROLES.Office,
  ROLES.ProjectManager,
] as const;

const CANNOT_MANAGE_SITES_ROLES = [ROLES.Technician, ROLES.Inventory] as const;

describe('manageSites permission (GAP-001)', () => {
  it('grants manageSites to every role authorized by backend CanManageSites', () => {
    for (const role of CAN_MANAGE_SITES_ROLES) {
      expect(hasPermission([role], 'manageSites')).toBe(true);
    }
  });

  it('denies manageSites to roles not authorized by backend CanManageSites', () => {
    for (const role of CANNOT_MANAGE_SITES_ROLES) {
      expect(hasPermission([role], 'manageSites')).toBe(false);
    }
  });

  it('lets ProjectManager manage sites without granting manageCustomers', () => {
    expect(hasPermission([ROLES.ProjectManager], 'manageSites')).toBe(true);
    expect(hasPermission([ROLES.ProjectManager], 'manageCustomers')).toBe(false);
  });

  it('keeps Office able to manage both customers and sites', () => {
    expect(hasPermission([ROLES.Office], 'manageSites')).toBe(true);
    expect(hasPermission([ROLES.Office], 'manageCustomers')).toBe(true);
  });
});
