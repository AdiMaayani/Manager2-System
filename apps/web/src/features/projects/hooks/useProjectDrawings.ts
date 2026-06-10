import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { delayMock } from '@shared/mock';
import {
  createProjectDrawingAsync,
  deleteProjectDrawingAsync,
  getProjectDrawingsAsync,
  uploadProjectDrawingAsync,
  updateProjectDrawingAsync,
} from '../api/projectsApiClient';
import type {
  CreateProjectDrawingRequest,
  UpdateProjectDrawingRequest,
  UploadProjectDrawingRequest,
} from '../types';

export function useProjectDrawings(projectId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['projectDrawings', projectId, isLocalDataMode],
    queryFn: () => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return resolveDataAsync(
        () => getProjectDrawingsAsync(projectId),
        () => delayMock([]),
      );
    },
    enabled: enabled && projectId != null && projectId > 0,
  });
}

export function useProjectDrawingMutations(projectId: number | null) {
  const queryClient = useQueryClient();

  const invalidateDrawings = () => {
    if (projectId == null) return;
    queryClient.invalidateQueries({ queryKey: ['projectDrawings', projectId] });
  };

  const createMutation = useMutation({
    mutationFn: (body: CreateProjectDrawingRequest) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return createProjectDrawingAsync(projectId, body);
    },
    onSuccess: invalidateDrawings,
  });

  const uploadMutation = useMutation({
    mutationFn: (body: UploadProjectDrawingRequest) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return uploadProjectDrawingAsync(projectId, body);
    },
    onSuccess: invalidateDrawings,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      projectDrawingId,
      body,
    }: {
      projectDrawingId: number;
      body: UpdateProjectDrawingRequest;
    }) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return updateProjectDrawingAsync(projectId, projectDrawingId, body);
    },
    onSuccess: invalidateDrawings,
  });

  const deleteMutation = useMutation({
    mutationFn: (projectDrawingId: number) => {
      if (projectId == null) {
        throw new Error('Project id is required.');
      }

      return deleteProjectDrawingAsync(projectId, projectDrawingId);
    },
    onSuccess: invalidateDrawings,
  });

  return {
    createMutation,
    uploadMutation,
    updateMutation,
    deleteMutation,
  };
}
