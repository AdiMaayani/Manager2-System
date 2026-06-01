export interface EmployeeUser {
  userId: number;
  employeeId: number;
  username: string;
  email: string;
  isActive: boolean;
  roles: string[];
  departments: string[];
  phone?: string;
  notes?: string;
}
