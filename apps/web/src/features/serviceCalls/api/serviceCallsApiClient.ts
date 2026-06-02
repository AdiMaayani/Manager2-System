import { apiRequest } from '@api/client';
import type {
  AssignServiceCallEmployeeRequest,
  ServiceCallCustomerOption,
  ServiceCallDetails,
  ServiceCallEmployeeOption,
  ServiceCallListItem,
  ServiceCallSiteOption,
  UpsertServiceCallRequest,
} from '../types';

interface CreateServiceCallResponse {
  message: string;
  workItemId: number;
}

interface ServiceCallMessageResponse {
  message: string;
}

export function getServiceCallsAsync(): Promise<ServiceCallListItem[]> {
  return apiRequest<ServiceCallListItem[]>('/ServiceCalls');
}

export function getServiceCallByIdAsync(serviceCallId: number): Promise<ServiceCallDetails> {
  return apiRequest<ServiceCallDetails>(`/ServiceCalls/${serviceCallId}`);
}

export function createServiceCallAsync(
  request: UpsertServiceCallRequest,
): Promise<CreateServiceCallResponse> {
  return apiRequest<CreateServiceCallResponse>('/ServiceCalls', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateServiceCallAsync(
  serviceCallId: number,
  request: UpsertServiceCallRequest,
): Promise<ServiceCallMessageResponse> {
  return apiRequest<ServiceCallMessageResponse>(`/ServiceCalls/${serviceCallId}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function closeServiceCallAsync(serviceCallId: number): Promise<ServiceCallMessageResponse> {
  return apiRequest<ServiceCallMessageResponse>(`/ServiceCalls/${serviceCallId}/close`, {
    method: 'PUT',
  });
}

export function assignEmployeeToServiceCallAsync(
  serviceCallId: number,
  request: AssignServiceCallEmployeeRequest,
): Promise<ServiceCallMessageResponse> {
  return apiRequest<ServiceCallMessageResponse>(`/ServiceCalls/${serviceCallId}/assign-employee`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function getServiceCallCustomersAsync(): Promise<ServiceCallCustomerOption[]> {
  return apiRequest<ServiceCallCustomerOption[]>('/Customers');
}

export function getServiceCallSitesAsync(): Promise<ServiceCallSiteOption[]> {
  return apiRequest<ServiceCallSiteOption[]>('/Sites');
}

export function getServiceCallEmployeesAsync(): Promise<ServiceCallEmployeeOption[]> {
  return apiRequest<ServiceCallEmployeeOption[]>('/Employees');
}
