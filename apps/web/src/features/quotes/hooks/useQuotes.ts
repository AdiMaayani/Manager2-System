import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createQuoteAsync,
  deactivateQuoteAsync,
  getQuoteByIdAsync,
  getQuoteCustomerOptionsAsync,
  getQuoteProjectOptionsAsync,
  getQuotesAsync,
  updateQuoteAsync,
} from '../api/quotesApiClient';
import type { QuoteFilters, SaveQuoteRequest } from '../types';

export function useQuotes(filters: QuoteFilters) {
  return useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => getQuotesAsync(filters),
    placeholderData: (previousData) => previousData,
  });
}

export function useQuote(quoteId: number | null) {
  return useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => getQuoteByIdAsync(quoteId as number),
    enabled: quoteId != null,
  });
}

export function useQuoteCustomerOptions() {
  return useQuery({
    queryKey: ['quoteCustomerOptions'],
    queryFn: getQuoteCustomerOptionsAsync,
  });
}

export function useQuoteProjectOptions() {
  return useQuery({
    queryKey: ['quoteProjectOptions'],
    queryFn: getQuoteProjectOptionsAsync,
  });
}

export function useQuoteMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['quotes'] });
    queryClient.invalidateQueries({ queryKey: ['quote'] });
  };

  const createMutation = useMutation({
    mutationFn: (request: SaveQuoteRequest) => createQuoteAsync(request),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: SaveQuoteRequest }) =>
      updateQuoteAsync(id, request),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateQuoteAsync(id),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deactivateMutation };
}
