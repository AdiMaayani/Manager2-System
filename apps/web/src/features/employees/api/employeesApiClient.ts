import { apiRequest } from '@api/client';
import type { Employee } from '../types';

export function getEmployeesAsync(): Promise<Employee[]> {
  return apiRequest<Employee[]>('/Employees');
}
