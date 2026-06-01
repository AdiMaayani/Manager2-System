export type AppDataMode = 'local' | 'mock';

const requestedAppDataMode = import.meta.env.VITE_APP_DATA_MODE;

export const appDataMode: AppDataMode = requestedAppDataMode === 'mock' ? 'mock' : 'local';

export const isLocalDataMode = appDataMode === 'local';

export const isMockDataMode = appDataMode === 'mock';
