/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_DATA_MODE: 'local' | 'mock';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'frappe-gantt' {
  export default class Gantt {
    constructor(
      element: HTMLElement,
      tasks: Array<{
        id: string;
        name: string;
        start: string;
        end: string;
        progress: number;
      }>,
      options?: { view_mode?: string; language?: string },
    );
  }
}
