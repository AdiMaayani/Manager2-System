/**
 * When the assignment-role field is blank and an employee is selected, seed it from
 * the Service Call requiredRole, otherwise the employee's primaryRole.
 * Never overwrites a nonblank value the user already entered.
 */
export function resolveDefaultAssignmentRole(params: {
  currentAssignmentRole: string;
  requiredRole?: string | null;
  employeePrimaryRole?: string | null;
}): string {
  if (params.currentAssignmentRole.trim()) {
    return params.currentAssignmentRole;
  }

  const requiredRole = params.requiredRole?.trim();
  if (requiredRole) return requiredRole;

  return params.employeePrimaryRole?.trim() ?? '';
}
