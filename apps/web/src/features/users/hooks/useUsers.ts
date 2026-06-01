import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUserAsync,
  deleteUserAsync,
  getUserDepartmentsAsync,
  getUserRolesAsync,
  getUsersAsync,
  updateUserAsync,
} from '../api/usersApiClient';
import type { CreateUserRequest, UpdateUserRequest } from '../types';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsersAsync,
  });
}

export function useUserLookups() {
  const rolesQuery = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: getUserRolesAsync,
    staleTime: 5 * 60 * 1000,
  });

  const departmentsQuery = useQuery({
    queryKey: ['users', 'departments'],
    queryFn: getUserDepartmentsAsync,
    staleTime: 5 * 60 * 1000,
  });

  return { rolesQuery, departmentsQuery };
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: (request: CreateUserRequest) => createUserAsync(request),
    onSuccess: invalidateUsers,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, request }: { id: number; request: UpdateUserRequest }) =>
      updateUserAsync(id, request),
    onSuccess: invalidateUsers,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteUserAsync(id),
    onSuccess: invalidateUsers,
  });

  return { createMutation, updateMutation, deleteMutation };
}
