import { apiRequest } from '@api/client';
import type { Customer, CreateCustomerRequest } from '../types';

export function getCustomersAsync(): Promise<Customer[]> {
  return apiRequest<Customer[]>('/Customers');
}

export function getCustomerByIdAsync(id: number): Promise<Customer> {
  return apiRequest<Customer>(`/Customers/${id}`);
}

export function createCustomerAsync(request: CreateCustomerRequest): Promise<Customer> {
  return apiRequest<Customer>('/Customers', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateCustomerAsync(id: number, request: CreateCustomerRequest): Promise<Customer> {
  return apiRequest<Customer>(`/Customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function deactivateCustomerAsync(id: number): Promise<void> {
  return apiRequest<void>(`/Customers/${id}`, { method: 'DELETE' });
}
