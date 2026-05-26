import { useQuery } from '@tanstack/react-query';
import { isLocalDataMode } from '@/config/appConfig';
import { resolveDataAsync } from '@shared/data/resolveDataAsync';
import { mockProjects, delayMock } from '@shared/mock';
import { getProjectsListAsync } from '../api/projectsApiClient';

export function useProjects() {
  return useQuery({
    queryKey: ['projects', isLocalDataMode],
    queryFn: () =>
      resolveDataAsync(getProjectsListAsync, () => delayMock(mockProjects)),
  });
}
