import { apiRequest } from '@api/client';
import type {
  CreateSecretRequest,
  CustomerSystem,
  CustomerSystemSecretMetadata,
  RevealedSecret,
  SaveCustomerSystemRequest,
  UpdateSecretRequest,
} from '../types';

const BASE_PATH = '/customer-systems';

export function getCustomerSystemsAsync(
  customerId: number,
  includeInactive = false,
): Promise<CustomerSystem[]> {
  const params = new URLSearchParams({ customerId: String(customerId) });
  if (includeInactive) params.set('includeInactive', 'true');
  return apiRequest<CustomerSystem[]>(`${BASE_PATH}?${params.toString()}`);
}

export function createCustomerSystemAsync(
  request: SaveCustomerSystemRequest,
): Promise<CustomerSystem> {
  return apiRequest<CustomerSystem>(BASE_PATH, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateCustomerSystemAsync(
  customerSystemId: number,
  request: SaveCustomerSystemRequest,
): Promise<CustomerSystem> {
  return apiRequest<CustomerSystem>(`${BASE_PATH}/${customerSystemId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function deactivateCustomerSystemAsync(customerSystemId: number): Promise<void> {
  return apiRequest<void>(`${BASE_PATH}/${customerSystemId}`, { method: 'DELETE' });
}

export function getCustomerSystemSecretsAsync(
  customerSystemId: number,
): Promise<CustomerSystemSecretMetadata[]> {
  return apiRequest<CustomerSystemSecretMetadata[]>(`${BASE_PATH}/${customerSystemId}/secrets`);
}

export function createCustomerSystemSecretAsync(
  customerSystemId: number,
  request: CreateSecretRequest,
): Promise<CustomerSystemSecretMetadata> {
  return apiRequest<CustomerSystemSecretMetadata>(`${BASE_PATH}/${customerSystemId}/secrets`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateCustomerSystemSecretAsync(
  customerSystemId: number,
  secretId: number,
  request: UpdateSecretRequest,
): Promise<CustomerSystemSecretMetadata> {
  return apiRequest<CustomerSystemSecretMetadata>(
    `${BASE_PATH}/${customerSystemId}/secrets/${secretId}`,
    {
      method: 'PUT',
      body: JSON.stringify(request),
    },
  );
}

export function deactivateCustomerSystemSecretAsync(
  customerSystemId: number,
  secretId: number,
): Promise<void> {
  return apiRequest<void>(`${BASE_PATH}/${customerSystemId}/secrets/${secretId}`, {
    method: 'DELETE',
  });
}

// The only call that returns a decrypted secret. Server records every reveal in the access log.
export function revealCustomerSystemSecretAsync(
  customerSystemId: number,
  secretId: number,
  accessReason?: string,
): Promise<RevealedSecret> {
  return apiRequest<RevealedSecret>(
    `${BASE_PATH}/${customerSystemId}/secrets/${secretId}/reveal`,
    {
      method: 'POST',
      body: JSON.stringify({ accessReason: accessReason ?? null }),
    },
  );
}
