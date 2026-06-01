// src/components/LoginScreen.tsx
import { useState } from "react";
import type { User } from "../types";
import { supabase } from "../lib/supabase";
import { I } from "../utils/constants";
import {
  hashPw as hashPwAsync, // 🔮 CORREÇÃO: Renomeamos na importação para evitar conflito!
  hashPwLegacy,
  isLegacyHash,
  checkRateLimit,
  recordFailedAttempt,
  clearAttempts,
  remainingAttempts,
  formatLockout,
  createSession,
  validateUsername,
  validatePassword
} from "../utils/security";

// Hash síncrono de lobby (senha de sala) — mantém compatibilidade com o LobbyBrowser
export const hashPw = hashPwLegacy;

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

type ScreenMode = "login" | "register" | "success";

const MAX_ATTEMPTS = 5;

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<ScreenMode>("login");
  const [u, setU]       = useState("");
  const [p, setP]       = useState("");
  const [confirmP, setConfirmP] = useState("");
  const [err, setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const clearForm = () => { setU(""); setP(""); setConfirmP(""); setErr(""); };

  // ── Login ─────────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    setErr("");
    const username = u.trim().toLowerCase();
    if (!username || !p) { setErr("Preencha todos os campos."); return; }

    // 1. Verifica rate limit ANTES de qualquer chamada ao banco
    const blockedMs = checkRateLimit(username);
    if (blockedMs !== null) {
      setErr(`Muitas tentativas. Aguarde ${formatLockout(blockedMs)}.`);
      return;
    }

    setLoading(true);

    try {
      // 2. Busca o usuário pelo nome (sem enviar a senha ainda)
      const { data: user, error } = await supabase
        .from("users")
        .select("username, pw_hash, created_at")
        .eq("username", username)
        .maybeSingle();

      if (error) throw error;

      if (!user) {
        // Não revela se o usuário existe ou não — mensagem genérica
        recordFailedAttempt(username);
        setErr(`Credenciais inválidas. ${remainingAttempts(username)} tentativa(s) restante(s).`);
        setLoading(false);
        return;
      }

      const storedHash = user.pw_hash as string;

      // 3. Tentativa com hash novo (SHA-256) - 🔮 USANDO O NOME CORRIGIDO
      const newHash = await hashPwAsync(p, username);
      let matched = newHash === storedHash;

      // 4. Fallback: tenta hash legado (djb2) para contas antigas
      if (!matched && isLegacyHash(storedHash)) {
        const legacyHash = hashPwLegacy(p);
        matched = legacyHash === storedHash;

        // 5. Migração silenciosa: atualiza para SHA-256 no banco
        if (matched) {
          await supabase
            .from("users")
            .update({ pw_hash: newHash })
            .eq("username", username);
        }
      }

      if (!matched) {
        recordFailedAttempt(username);
        const left = remainingAttempts(username);
        setErr(left > 0
          ? `Credenciais inválidas. ${left} tentativa(s) restante(s).`
          : "Conta bloqueada por 5 minutos após excesso de tentativas."
        );
        setLoading(false);
        return;
      }

      // 6. Login bem-sucedido
      clearAttempts(username);
      const session = createSession(username, newHash);
      await window.storage.set("rpg_sess", JSON.stringify(session));
      onLogin({ username: user.username, pwHash: newHash, createdAt: user.created_at });

    } catch {
      setErr("Erro de conexão com o servidor.");
    }

    setLoading(false);
  };

  // ── Registro ──────────────────────────────────────────────────────────────

  const handleRegister = async () => {
    setErr("");

    const username = u.trim().toLowerCase();

    // Validações com mensagens específicas
    const uvr = validateUsername(u);
    if (!uvr.ok) { setErr(uvr.message!); return; }

    const pvr = validatePassword(p);
    if (!pvr.ok) { setErr(pvr.message!); return; }

    if (p !== confirmP) { setErr("As senhas informadas não coincidem."); return; }

    setLoading(true);

    try {
      // Verifica disponibilidade do nome
      const { data: existing, error: checkError } = await supabase
        .from("users")
        .select("username")
        .eq("username", username)
        .maybeSingle();

      if (checkError) throw checkError;
      if (existing) { setErr("Usuário já existe. Escolha outro nome."); setLoading(false); return; }

      // Cria conta com SHA-256 desde o início - 🔮 USANDO O NOME CORRIGIDO
      const pw = await hashPwAsync(p, username);
      const { error: insertError } = await supabase
        .from("users")
        .insert([{ username, pw_hash: pw, created_at: Date.now() }]);

      if (insertError) throw insertError;

      setMode("success");
      setP(""); setConfirmP(""); setErr("");

    } catch {
      setErr("Erro ao criar a conta no servidor.");
    }

    setLoading(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "370px" }}>

        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "56px", marginBottom: "8px" }}>🎲</div>
          <h1 style={{ color: "#f59e0b", fontFamily: "Georgia", fontSize: "28px", margin: 0 }}>RPG Companion</h1>
          <p style={{ color: "#64748b", margin: "8px 0 0", fontSize: "14px" }}>Mesa Digital para Mestres e Jogadores</p>
        </div>

        {/* JANELA 1: LOGIN */}
        {mode === "login" && (
          <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", display: "grid", gap: "14px" }}>
            <h2 style={{ color: "#f59e0b", margin: "0 0 2px", fontSize: "18px", fontFamily: "Georgia" }}>Entrar na Sessão</h2>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>USUÁRIO</label>
              <input
                style={{ ...I, fontSize: "15px", padding: "10px 12px" }}
                value={u}
                onChange={e => setU(e.target.value)}
                placeholder="Seu nome de usuário"
                autoComplete="username"
                maxLength={20}
              />
            </div>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>SENHA</label>
              <input
                type="password"
                style={{ ...I, fontSize: "15px", padding: "10px 12px" }}
                value={p}
                onChange={e => setP(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                maxLength={72}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>

            {/* Aviso de tentativas restantes */}
            {u.trim() && !err && (() => {
              const rem = remainingAttempts(u.trim().toLowerCase());
              return rem < MAX_ATTEMPTS && rem > 0 ? (
                <div style={{ color: "#f59e0b", fontSize: "12px", padding: "6px 10px", background: "#1c1200", borderRadius: "6px" }}>
                  ⚠️ {rem} tentativa(s) antes do bloqueio temporário.
                </div>
              ) : null;
            })()}

            {err && (
              <div style={{ color: "#f87171", fontSize: "13px", padding: "8px 10px", background: "#1c0a0a", borderRadius: "6px" }}>
                ⚠️ {err}
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px #f59e0b44" }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <div style={{ textAlign: "center", borderTop: "1px solid #334155", paddingTop: "14px", marginTop: "4px" }}>
              <button
                onClick={() => { setMode("register"); clearForm(); }}
                style={{ background: "transparent", color: "#60a5fa", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}
              >
                Não tem uma conta? Forjar nova conta
              </button>
            </div>
          </div>
        )}

        {/* JANELA 2: REGISTRO */}
        {mode === "register" && (
          <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", display: "grid", gap: "14px" }}>
            <h2 style={{ color: "#f59e0b", margin: "0 0 2px", fontSize: "18px", fontFamily: "Georgia" }}>Forjar Nova Conta</h2>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>NOME DE USUÁRIO</label>
              <input
                style={{ ...I, fontSize: "15px", padding: "10px 12px" }}
                value={u}
                onChange={e => setU(e.target.value)}
                placeholder="3–20 caracteres, letras e números"
                autoComplete="username"
                maxLength={20}
              />
            </div>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>SENHA MÁGICA</label>
              <input
                type="password"
                style={{ ...I, fontSize: "15px", padding: "10px 12px" }}
                value={p}
                onChange={e => setP(e.target.value)}
                placeholder="Mínimo de 4 caracteres"
                autoComplete="new-password"
                maxLength={72}
              />
            </div>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>CONFIRMAR SENHA</label>
              <input
                type="password"
                style={{ ...I, fontSize: "15px", padding: "10px 12px" }}
                value={confirmP}
                onChange={e => setConfirmP(e.target.value)}
                placeholder="Repita a senha para validação"
                autoComplete="new-password"
                maxLength={72}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
              />
            </div>

            {err && (
              <div style={{ color: "#f87171", fontSize: "13px", padding: "8px 10px", background: "#1c0a0a", borderRadius: "6px" }}>
                ⚠️ {err}
              </div>
            )}

            <button
              onClick={handleRegister}
              disabled={loading}
              style={{ background: "#22c55e", color: "#111", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px #22c55e44" }}
            >
              {loading ? "Gravando no banco..." : "⚔️ Confirmar Criação"}
            </button>

            <button
              onClick={() => { setMode("login"); clearForm(); }}
              style={{ background: "transparent", color: "#64748b", border: "1px solid #374151", borderRadius: "8px", padding: "12px", fontSize: "14px", cursor: "pointer" }}
            >
              Cancelar e Voltar
            </button>
          </div>
        )}

        {/* JANELA 3: SUCESSO */}
        {mode === "success" && (
          <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", display: "grid", gap: "14px", textAlign: "center" }}>
            <div style={{ fontSize: "48px" }}>✨</div>
            <h2 style={{ color: "#22c55e", margin: 0, fontSize: "20px", fontFamily: "Georgia" }}>Aventureiro Registrado!</h2>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: "4px 0 12px", lineHeight: "1.6" }}>
              As crônicas da taverna foram salvas na nuvem. O usuário{" "}
              <strong style={{ color: "#e2e8f0" }}>{u}</strong> está pronto para iniciar sua jornada.
            </p>
            <button
              onClick={() => { setMode("login"); clearForm(); }}
              style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 14px #f59e0b44" }}
            >
              Avançar para o Login →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}