// Client-side mirror of the ManageR2 role/permission matrix.
//
// IMPORTANT: this is for UX only (hiding nav/routes/actions the user cannot use). The real
// enforcement lives server-side in the API authorization policies. Roles here match the
// dbo.Roles catalog and the role claims embedded in the JWT / session user.

export type Permission =
  // Screen visibility (nav + route access)
  | 'viewWorkPlan'
  | 'viewProjects'
  | 'viewServiceCalls'
  | 'viewCustomers'
  | 'viewContacts'
  | 'viewQuotes'
  | 'viewInventory'
  | 'viewReports'
  | 'viewEmployees'
  | 'viewUsers'
  | 'viewSettings'
  // Minimal employee selection lookup (id + display fields) for pickers/forms
  | 'lookupEmployees'
  // Actions (write/management) — kept aligned with the backend policies
  | 'manageCustomers'
  | 'manageContacts'
  | 'manageProjects'
  | 'manageWorkPlan'
  | 'manageInventory'
  | 'manageQuotes'
  | 'manageServiceCalls'
  | 'editReports'
  | 'manageUsers'
  | 'manageSettings';

export const ROLES = {
  Admin: 'Admin',
  SeniorManagement: 'SeniorManagement',
  ProjectManager: 'ProjectManager',
  Office: 'Office',
  Technician: 'Technician',
  Inventory: 'Inventory',
} as const;

const ALL_PERMISSIONS: Permission[] = [
  'viewWorkPlan',
  'viewProjects',
  'viewServiceCalls',
  'viewCustomers',
  'viewContacts',
  'viewQuotes',
  'viewInventory',
  'viewReports',
  'viewEmployees',
  'viewUsers',
  'viewSettings',
  'lookupEmployees',
  'manageCustomers',
  'manageContacts',
  'manageProjects',
  'manageWorkPlan',
  'manageInventory',
  'manageQuotes',
  'manageServiceCalls',
  'editReports',
  'manageUsers',
  'manageSettings',
];

// Per-role permission grants. Admin receives every permission. Each other role lists exactly the
// permissions it should have; anything omitted is denied.
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [ROLES.Admin]: ALL_PERMISSIONS,

  [ROLES.SeniorManagement]: [
    'viewWorkPlan',
    'viewProjects',
    'viewServiceCalls',
    'viewCustomers',
    'viewContacts',
    'viewQuotes',
    'viewInventory',
    'viewReports',
    'viewEmployees',
    'lookupEmployees',
    'manageCustomers',
    'manageContacts',
    'manageProjects',
    'manageWorkPlan',
    'manageInventory',
    'manageQuotes',
    'manageServiceCalls',
    'editReports',
  ],

  [ROLES.ProjectManager]: [
    'viewWorkPlan',
    'viewProjects',
    'viewServiceCalls',
    'viewCustomers',
    'viewContacts',
    'viewReports',
    'lookupEmployees',
    'manageProjects',
    'manageWorkPlan',
    'manageServiceCalls',
    'editReports',
  ],

  [ROLES.Office]: [
    'viewWorkPlan',
    'viewServiceCalls',
    'viewCustomers',
    'viewContacts',
    'viewQuotes',
    'viewReports',
    'lookupEmployees',
    'manageCustomers',
    'manageContacts',
    'manageQuotes',
    'manageServiceCalls',
    'editReports',
  ],

  [ROLES.Technician]: [
    'viewWorkPlan',
    'viewServiceCalls',
    'viewReports',
    'lookupEmployees',
    'editReports',
  ],

  [ROLES.Inventory]: [
    'viewInventory',
    'manageInventory',
  ],
};

// Returns true when any of the user's roles grants the requested permission.
export function hasPermission(roles: readonly string[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false);
}

// Returns true when the user holds at least one of the requested permissions.
export function hasAnyPermission(roles: readonly string[], permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(roles, permission));
}
