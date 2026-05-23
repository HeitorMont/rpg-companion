// src/types/storage.d.ts

interface StorageItem {
  key: string;
  value: string;
}

interface CustomWindowStorage {
  // O get continua com o global opcional, pois ele pode precisar
  get: (key: string, global?: boolean) => Promise<StorageItem | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

// Estende a interface Window nativa do ecossistema do navegador
declare global {
  interface Window {
    storage: CustomWindowStorage;
  }
}

export {};