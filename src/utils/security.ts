// src/utils/security.ts
// Módulo central de segurança. Toda lógica sensível passa por aqui.

// ── Constantes ────────────────────────────────────────────────────────────────

const APP_SALT        = "rpg-companion-salt-v2"; // Altere se mudar o esquema de hash
const MAX_ATTEMPTS    = 5;
const LOCKOUT_MS      = 5 * 60 * 1000;           // 5 minutos
const SESSION_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 dias

// ── Hash de senha ─────────────────────────────────────────────────────────────

/**
 * Hash legado (djb2) — mantido APENAS para migrar contas antigas.
 * NÃO use em código novo.
 */
export const hashPwLegacy = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
};

/**
 * Hash seguro: SHA-256 com salt duplo (app-level + username).
 *
 * Por que é melhor que djb2:
 *   - SHA-256 é criptograficamente seguro (djb2 não é)
 *   - O salt com username impede rainbow tables cross-user
 *   - O salt estático APP_SALT impede ataques offline genéricos
 *   - Retorna 64 chars hex, fácil de distinguir do formato base-36 legado
 */
export const hashPw = async (password: string, username: string): Promise<string> => {
  const input   = `${APP_SALT}:${username.toLowerCase()}:${password}`;
  const encoded = new TextEncoder().encode(input);
  const buffer  = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Detecta se um hash armazenado é o formato legado (djb2 = base-36 curto)
 * ou o novo formato (SHA-256 = 64 chars hex).
 */
export const isLegacyHash = (hash: string): boolean => hash.length < 20;

// ── Rate limiting de login ────────────────────────────────────────────────────

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}

const attemptKey = (username: string) =>
  `rpg_attempts_${username.toLowerCase()}`;

const getAttempts = (username: string): AttemptRecord => {
  try {
    const raw = localStorage.getItem(attemptKey(username));
    return raw ? JSON.parse(raw) : { count: 0, lockedUntil: 0 };
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
};

/**
 * Retorna quantos ms faltam para o desbloqueio, ou null se livre.
 */
export const checkRateLimit = (username: string): number | null => {
  const { lockedUntil } = getAttempts(username);
  if (lockedUntil > Date.now()) return lockedUntil - Date.now();
  return null;
};

/**
 * Registra uma tentativa fracassada. Bloqueia após MAX_ATTEMPTS.
 */
export const recordFailedAttempt = (username: string): void => {
  const state    = getAttempts(username);
  const newCount = state.count + 1;
  const updated: AttemptRecord = {
    count:       newCount,
    lockedUntil: newCount >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : state.lockedUntil,
  };
  localStorage.setItem(attemptKey(username), JSON.stringify(updated));
};

/** Limpa o contador após login bem-sucedido. */
export const clearAttempts = (username: string): void =>
  localStorage.removeItem(attemptKey(username));

/** Quantas tentativas restam antes do bloqueio. */
export const remainingAttempts = (username: string): number =>
  Math.max(0, MAX_ATTEMPTS - getAttempts(username).count);

export const formatLockout = (ms: number): string => {
  const secs = Math.ceil(ms / 1000);
  return secs < 60 ? `${secs}s` : `${Math.ceil(secs / 60)}min`;
};

// ── Sessão com expiração ──────────────────────────────────────────────────────

export interface Session {
  username: string;
  pwHash:   string;
  expiresAt: number;
}

export const createSession = (username: string, pwHash: string): Session => ({
  username,
  pwHash,
  expiresAt: Date.now() + SESSION_TTL_MS,
});

export const isSessionValid = (s: Session): boolean =>
  Boolean(s?.username && s?.pwHash && s?.expiresAt > Date.now());

// ── Validação de entrada ──────────────────────────────────────────────────────

interface ValidationResult {
  ok: boolean;
  message?: string;
}

export const validateUsername = (raw: string): ValidationResult => {
  const v = raw.trim();
  if (v.length < 3)  return { ok: false, message: "Mínimo de 3 caracteres." };
  if (v.length > 20) return { ok: false, message: "Máximo de 20 caracteres." };
  if (!/^[a-zA-Z0-9_\-]+$/.test(v))
    return { ok: false, message: "Apenas letras, números, _ e -." };
  return { ok: true };
};

export const validatePassword = (raw: string): ValidationResult => {
  if (raw.length < 4)  return { ok: false, message: "Mínimo de 4 caracteres." };
  if (raw.length > 72) return { ok: false, message: "Máximo de 72 caracteres." };
  return { ok: true };
};

export const validateLobbyName = (raw: string): ValidationResult => {
  const v = raw.trim();
  if (v.length < 2)  return { ok: false, message: "Mínimo de 2 caracteres." };
  if (v.length > 40) return { ok: false, message: "Máximo de 40 caracteres." };
  return { ok: true };
};

/**
 * Valida o formato de um lobby ID antes de usar em caminhos de storage.
 * Previne path traversal (ex: "../outro-lobby/arquivo").
 */
export const isValidLobbyId = (id: string): boolean =>
  /^[a-z0-9]{10,40}$/.test(id);

/** Remove tags HTML e normaliza espaços — use antes de exibir input do usuário. */
export const sanitize = (raw: string): string =>
  raw.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
