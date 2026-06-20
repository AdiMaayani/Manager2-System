import { apiRequest } from '@api/client';
import type {
  QuoteCustomerOption,
  QuoteDetails,
  QuoteFilters,
  QuoteListItem,
  QuoteProjectOption,
  SaveQuoteRequest,
} from '../types';

function buildQuoteQuery(filters: QuoteFilters): string {
  const params = new URLSearchParams();

  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.customerId) params.set('customerId', String(filters.customerId));
  if (filters.projectId) params.set('projectId', String(filters.projectId));
  if (filters.status) params.set('status', filters.status);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.includeInactive) params.set('includeInactive', 'true');

  const query = params.toString();
  return query ? `?${query}` : '';
}

export function getQuotesAsync(filters: QuoteFilters): Promise<QuoteListItem[]> {
  return apiRequest<QuoteListItem[]>(`/Quotes${buildQuoteQuery(filters)}`);
}

export function getQuoteByIdAsync(id: number): Promise<QuoteDetails> {
  return apiRequest<QuoteDetails>(`/Quotes/${id}`);
}

export function createQuoteAsync(request: SaveQuoteRequest): Promise<QuoteDetails> {
  return apiRequest<QuoteDetails>('/Quotes', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateQuoteAsync(id: number, request: SaveQuoteRequest): Promise<QuoteDetails> {
  return apiRequest<QuoteDetails>(`/Quotes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function deactivateQuoteAsync(id: number): Promise<void> {
  return apiRequest<void>(`/Quotes/${id}`, { method: 'DELETE' });
}

// Customer picker source for the quote form (reuses the existing customers endpoint).
export function getQuoteCustomerOptionsAsync(): Promise<QuoteCustomerOption[]> {
  return apiRequest<QuoteCustomerOption[]>('/Customers');
}

// Project picker source for the quote form (reuses the existing projects list endpoint).
export function getQuoteProjectOptionsAsync(): Promise<QuoteProjectOption[]> {
  return apiRequest<QuoteProjectOption[]>('/WorkItems/projects-list');
}
