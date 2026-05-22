// src/types/storage.d.ts

interface StorageItem {
  key: string;
  value: string;
}

interface CustomWindowStorage {
  // 🔮 Adicionado o 'global?: boolean' para aceitar o segundo argumento opcional!
  get: (key: string, global?: boolean) => Promise<StorageItem | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string, global?: boolean) => Promise<void>;
}

// Estende a interface Window nativa do ecossistema do navegador
declare global {
  interface Window {
    storage: CustomWindowStorage;
  }
}

export {};