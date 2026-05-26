import { isLocalDataMode } from '@/config/appConfig';

export async function resolveDataAsync<T>(
  fetchLocalAsync: () => Promise<T>,
  fetchMockAsync: () => Promise<T>,
): Promise<T> {
  return isLocalDataMode ? fetchLocalAsync() : fetchMockAsync();
}
