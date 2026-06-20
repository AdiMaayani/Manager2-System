/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface BarcodeDetectorOptions {
  formats?: string[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>>;
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
