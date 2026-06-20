import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getContactsAsync,
  createContactAsync,
  updateContactAsync,
  deleteContactAsync,
} from '../api/contactsApiClient';
import type { CreateContactRequest } from '../types';

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: getContactsAsync,
  });
}

export function useContactMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['contacts'] });

  const createMutation = useMutation({
    mutationFn: (req: CreateContactRequest) => createContactAsync(req),
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, req }: { id: number; req: CreateContactRequest }) =>
      updateContactAsync(id, req),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteContactAsync(id),
    onSuccess: invalidate,
  });

  return { createMutation, updateMutation, deleteMutation };
}
