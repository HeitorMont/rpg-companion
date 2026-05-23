// src/types/storage.d.ts

interface StorageItem {
  key: string;
  value: string;
}

interface CustomWindowStorage {
  get: (key: string, global?: boolean) => Promise<StorageItem | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  // 🛡️ Adicionado o método list que estava faltando!
  list: () => Promise<StorageItem[]>; 
}

declare global {
  interface Window {
    storage: CustomWindowStorage;
  }
}

export {};