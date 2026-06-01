export interface User {
  userId: number;
  employeeId: number;
  username: string;
  email: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  phone?: string | null;
  notes?: string | null;
  roles: string[];
  departments: string[];
}

export interface CreateUserRequest {
  employeeId: number;
  username: string;
  email: string;
  password: string;
  isActive: boolean;
  phone?: string;
  notes?: string;
  roles: string[];
  departments: string[];
}

export interface UpdateUserRequest {
  employeeId: number;
  username: string;
  email: string;
  password: string;
  isActive: boolean;
  phone?: string;
  notes?: string;
  roles: string[];
  departments: string[];
}
