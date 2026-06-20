import { apiRequest } from '@api/client';
import { categoryToEnum, enumToCategory } from '../categoryMapping';
import type { Contact, CreateContactRequest } from '../types';

/** Normalise a single contact received from the API — DB enum → Hebrew label. */
function normaliseContact(raw: Contact): Contact {
  return { ...raw, contactCategory: enumToCategory(raw.contactCategory) };
}

/** Normalise a write request — Hebrew label → DB enum — before sending to the API. */
function toApiRequest(request: CreateContactRequest): CreateContactRequest {
  return { ...request, contactCategory: categoryToEnum(request.contactCategory) };
}

export async function getContactsAsync(): Promise<Contact[]> {
  const contacts = await apiRequest<Contact[]>('/Contacts');
  return contacts.map(normaliseContact);
}

export async function getContactByIdAsync(id: number): Promise<Contact> {
  const contact = await apiRequest<Contact>(`/Contacts/${id}`);
  return normaliseContact(contact);
}

export async function createContactAsync(request: CreateContactRequest): Promise<Contact> {
  const contact = await apiRequest<Contact>('/Contacts', {
    method: 'POST',
    body: JSON.stringify(toApiRequest(request)),
  });
  return normaliseContact(contact);
}

export async function updateContactAsync(
  id: number,
  request: CreateContactRequest,
): Promise<Contact> {
  const contact = await apiRequest<Contact>(`/Contacts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(toApiRequest(request)),
  });
  return normaliseContact(contact);
}

export function deleteContactAsync(id: number): Promise<void> {
  return apiRequest<void>(`/Contacts/${id}`, { method: 'DELETE' });
}
