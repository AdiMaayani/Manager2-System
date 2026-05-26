import { apiRequest } from '@api/client';
import type { Customer } from '../types';

export function getCustomersAsync(): Promise<Customer[]> {
  return apiRequest<Customer[]>('/Customers');
}
