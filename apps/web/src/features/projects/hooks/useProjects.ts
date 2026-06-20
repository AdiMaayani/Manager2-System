import { useQuery } from '@tanstack/react-query';
import { getProjectsListAsync } from '../api/projectsApiClient';

export function useProjects(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['projects'],
    queryFn: getProjectsListAsync,
    enabled: options?.enabled ?? true,
  });
}
