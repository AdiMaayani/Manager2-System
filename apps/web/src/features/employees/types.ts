export interface Employee {
  employeeId: number;
  fullName: string;
  primaryRole: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  isAssignable: boolean;
}
