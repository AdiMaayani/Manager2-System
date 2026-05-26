export type AppDataMode = 'local' | 'mock';

export const appDataMode = (import.meta.env.VITE_APP_DATA_MODE ?? 'local') as AppDataMode;

export const isLocalDataMode = appDataMode === 'local';

export const isMockDataMode = appDataMode === 'mock';
