import { apiRequest } from '@api/client';
import type { Employee, SetEmployeeActiveStatusRequest, UpsertEmployeeRequest } from '../types';

export function getEmployeesAsync(): Promise<Employee[]> {
  return apiRequest<Employee[]>('/Employees');
}

export function getEmployeeByIdAsync(id: number): Promise<Employee> {
  return apiRequest<Employee>(`/Employees/${id}`);
}

export function createEmployeeAsync(request: UpsertEmployeeRequest): Promise<Employee> {
  return apiRequest<Employee>('/Employees', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateEmployeeAsync(
  id: number,
  request: UpsertEmployeeRequest,
): Promise<Employee> {
  return apiRequest<Employee>(`/Employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function setEmployeeActiveStatusAsync(
  id: number,
  request: SetEmployeeActiveStatusRequest,
): Promise<Employee> {
  return apiRequest<Employee>(`/Employees/${id}/active-status`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}
