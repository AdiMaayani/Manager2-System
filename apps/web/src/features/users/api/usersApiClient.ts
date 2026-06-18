import { apiRequest } from '@api/client';
import type {
  CreateUserRequest,
  RestoreUserRequest,
  UpdateUserRequest,
  User,
} from '../types';

export function getUsersAsync(): Promise<User[]> {
  return apiRequest<User[]>('/Users');
}

export function getUserRolesAsync(): Promise<string[]> {
  return apiRequest<string[]>('/Users/roles');
}

export function getUserDepartmentsAsync(): Promise<string[]> {
  return apiRequest<string[]>('/Users/departments');
}

export function createUserAsync(request: CreateUserRequest): Promise<User> {
  return apiRequest<User>('/Users', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateUserAsync(id: number, request: UpdateUserRequest): Promise<User> {
  return apiRequest<User>(`/Users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function deleteUserAsync(id: number): Promise<void> {
  return apiRequest<void>(`/Users/${id}`, { method: 'DELETE' });
}

export function restoreUserAsync(id: number, request: RestoreUserRequest): Promise<User> {
  return apiRequest<User>(`/Users/${id}/restore`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
