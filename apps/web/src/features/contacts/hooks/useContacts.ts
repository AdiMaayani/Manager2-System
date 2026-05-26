import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockContacts, delayMock } from '@shared/mock';
import {
  getContactsAsync,
  createContactAsync,
  updateContactAsync,
  deleteContactAsync,
} from '../api/contactsApiClient';
import type { CreateContactRequest } from '../types';

export function useContacts() {
  return useQuery({
    queryKey: ['contacts', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getContactsAsync, () => delayMock(mockContacts)),
  });
}

export function useContactMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contacts'] });

  const createMutation = useMutation({
    mutationFn: (req: CreateContactRequest) =>
      isLocalDataMode ? createContactAsync(req) : delayMock({ ...req, contactId: Date.now() } as never),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: number; req: CreateContactRequest }) =>
      isLocalDataMode ? updateContactAsync(id, req) : delayMock(undefined),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      isLocalDataMode ? deleteContactAsync(id) : delayMock(undefined),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deleteMutation };
}
