// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Puxa as runas de acesso protegidas do seu arquivo .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("⚠️ Erro de Conjunção: Chaves do Supabase não encontradas no arquivo .env!");
}

// Inicializa o cliente oficial do Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);