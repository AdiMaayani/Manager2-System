import { apiRequest } from '@api/client';
import type { Contact, CreateContactRequest } from '../types';

export function getContactsAsync(): Promise<Contact[]> {
  return apiRequest<Contact[]>('/Contacts');
}

export function getContactByIdAsync(id: number): Promise<Contact> {
  return apiRequest<Contact>(`/Contacts/${id}`);
}

export function createContactAsync(request: CreateContactRequest): Promise<Contact> {
  return apiRequest<Contact>('/Contacts', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateContactAsync(id: number, request: CreateContactRequest): Promise<Contact> {
  return apiRequest<Contact>(`/Contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function deleteContactAsync(id: number): Promise<void> {
  return apiRequest<void>(`/Contacts/${id}`, { method: 'DELETE' });
}
