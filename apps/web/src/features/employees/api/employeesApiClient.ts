import { apiRequest } from '@api/client';
import type { EmployeeUser } from '../types';

export function getUsersAsync(): Promise<EmployeeUser[]> {
  return apiRequest<EmployeeUser[]>('/Users');
}
