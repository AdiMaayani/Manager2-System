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
