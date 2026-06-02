export type AppDataMode = 'local' | 'mock';

const requestedAppDataMode = import.meta.env.VITE_APP_DATA_MODE;

function resolveAppDataMode(value: string | undefined): AppDataMode {
  if (!value || value === 'local') return 'local';

  if (value === 'mock') {
    if (import.meta.env.PROD) {
      throw new Error('VITE_APP_DATA_MODE=mock is only allowed for local development.');
    }

    return 'mock';
  }

  throw new Error('Invalid VITE_APP_DATA_MODE. Expected "local" or "mock".');
}

export const appDataMode: AppDataMode = resolveAppDataMode(requestedAppDataMode);

export const appEnvironment = import.meta.env.MODE;

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

export const isLocalDataMode = appDataMode === 'local';

export const isMockDataMode = appDataMode === 'mock';
