import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { delayMock } from '@shared/mock';
import {
  createProjectEquipmentAsync,
  deleteProjectEquipmentAsync,
  getProjectEquipmentAsync,
  reorderProjectEquipmentAsync,
  updateProjectEquipmentAsync,
} from '../api/projectsApiClient';
import type {
  CreateProjectEquipmentItemRequest,
  ProjectEquipmentItem,
  ReorderProjectEquipmentRequest,
  UpdateProjectEquipmentItemRequest,
} from '../types';
import { DEFAULT_EQUIPMENT } from '../utils/projectDisplayUtils';

export function useProjectEquipment(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['projectEquipment', projectId, isLocalDataMode],
    queryFn: () => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return resolveDataAsync(
        () => getProjectEquipmentAsync(projectId),
        () =>
          delayMock(
            DEFAULT_EQUIPMENT.map((equipmentItem) => ({
              ...equipmentItem,
              projectId,
            })),
          ),
      );
    },
    enabled: enabled && projectId != null && projectId > 0,
  });
}

export function useProjectEquipmentMutations(projectId: number | null) {
  const queryClient = useQueryClient();

  const invalidateEquipment = () => {
    if (projectId == null) return;
    queryClient.invalidateQueries({ queryKey: ['projectEquipment', projectId] });
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateProjectEquipmentItemRequest) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return createProjectEquipmentAsync(projectId, body);
    },
    onSuccess: invalidateEquipment,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      equipmentItemId,
      body,
    }: {
      equipmentItemId: number;
      body: UpdateProjectEquipmentItemRequest;
    }) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return updateProjectEquipmentAsync(projectId, equipmentItemId, body);
    },
    onSuccess: invalidateEquipment,
  });

  const deleteMutation = useMutation({
    mutationFn: (equipmentItemId: number) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return deleteProjectEquipmentAsync(projectId, equipmentItemId);
    },
    onSuccess: invalidateEquipment,
  });

  const reorderMutation = useMutation({
    mutationFn: (body: ReorderProjectEquipmentRequest) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return reorderProjectEquipmentAsync(projectId, body);
    },
    onSuccess: invalidateEquipment,
  });

  return {
    createMutation,
    updateMutation,
    deleteMutation,
    reorderMutation,
  };
}

export function buildProjectEquipmentReorderRequest(
  equipmentItems: ProjectEquipmentItem[],
): ReorderProjectEquipmentRequest {
  return {
    items: equipmentItems.map((equipmentItem, index) => ({
      projectEquipmentItemId: equipmentItem.projectEquipmentItemId,
      sortOrder: index + 1,
    })),
  };
}
