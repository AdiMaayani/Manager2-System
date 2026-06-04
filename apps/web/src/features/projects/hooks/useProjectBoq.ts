import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { delayMock } from '@shared/mock';
import {
  createProjectBoqItemAsync,
  deleteProjectBoqItemAsync,
  getProjectBoqAsync,
  reorderProjectBoqAsync,
  updateProjectBoqItemAsync,
} from '../api/projectsApiClient';
import type {
  CreateProjectBoqItemRequest,
  ProjectBoqItem,
  ReorderProjectBoqRequest,
  UpdateProjectBoqItemRequest,
} from '../types';
import { DEFAULT_BOQ_ROWS } from '../utils/projectDisplayUtils';

export function useProjectBoq(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['projectBoq', projectId, isLocalDataMode],
    queryFn: () => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return resolveDataAsync(
        () => getProjectBoqAsync(projectId),
        () =>
          delayMock(
            DEFAULT_BOQ_ROWS.map((boqItem) => ({
              ...boqItem,
              projectId,
            })),
          ),
      );
    },
    enabled: enabled && projectId != null && projectId > 0,
  });
}

export function useProjectBoqMutations(projectId: number | null) {
  const queryClient = useQueryClient();

  const invalidateBoq = () => {
    if (projectId == null) return;
    queryClient.invalidateQueries({ queryKey: ['projectBoq', projectId] });
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateProjectBoqItemRequest) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return createProjectBoqItemAsync(projectId, body);
    },
    onSuccess: invalidateBoq,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      boqItemId,
      body,
    }: {
      boqItemId: number;
      body: UpdateProjectBoqItemRequest;
    }) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return updateProjectBoqItemAsync(projectId, boqItemId, body);
    },
    onSuccess: invalidateBoq,
  });

  const deleteMutation = useMutation({
    mutationFn: (boqItemId: number) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return deleteProjectBoqItemAsync(projectId, boqItemId);
    },
    onSuccess: invalidateBoq,
  });

  const reorderMutation = useMutation({
    mutationFn: (body: ReorderProjectBoqRequest) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return reorderProjectBoqAsync(projectId, body);
    },
    onSuccess: invalidateBoq,
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    reorderMutation,
  };
}

export function buildProjectBoqReorderRequest(
  boqItems: ProjectBoqItem[],
): ReorderProjectBoqRequest {
  return {
    items: boqItems.map((boqItem, index) => ({
      projectBoqItemId: boqItem.projectBoqItemId,
      sortOrder: index + 1,
    })),
  };
}
