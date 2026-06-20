export interface Employee {
  employeeId: number;
  fullName: string;
  primaryRole: string;
  phone?: string;
  email?: string;
  dailyCapacityHours?: number | null;
  isActive: boolean;
  isAssignable: boolean;
  createdAt?: string;
}

// Minimal employee projection returned by GET /Employees/lookup (no contact PII).
export interface EmployeeLookupItem {
  employeeId: number;
  fullName: string;
  primaryRole: string;
  dailyCapacityHours?: number | null;
  isAssignable: boolean;
  isActive: boolean;
}

export interface UpsertEmployeeRequest {
  fullName: string;
  primaryRole: string;
  phone?: string;
  email?: string;
  dailyCapacityHours?: number | null;
  isAssignable: boolean;
  isActive: boolean;
}

export interface SetEmployeeActiveStatusRequest {
  isActive: boolean;
}
