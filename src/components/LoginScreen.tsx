// src/components/LoginScreen.tsx
import { useState } from "react";
import type { User } from "../types";

// Função de hash simples exportada (será útil depois)
export const hashPw = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
};

// Estilo de Input padrão
const I = {
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
  padding: "8px 10px",
  color: "#e5e7eb",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box" as const,
};

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (isReg: boolean) => {
    setErr("");
    if (!u.trim() || !p.trim()) { setErr("Preencha todos os campos."); return; }
    if (u.trim().length < 3) { setErr("Usuário: mínimo 3 caracteres."); return; }
    if (p.length < 4) { setErr("Senha: mínimo 4 caracteres."); return; }
    setLoading(true);
    
    const key = `rpg_user:${u.trim().toLowerCase()}`;
    const pw = hashPw(p);
    
    try {
      let ex = null;
      try {
        // @ts-ignore
        const r = await window.storage.get(key, true);
        if (r) ex = JSON.parse(r.value);
      } catch {}
      
      if (isReg) {
        if (ex) { setErr("Usuário já existe. Faça login."); setLoading(false); return; }
        const usr: User = { username: u.trim(), pwHash: pw, createdAt: Date.now() };
        // @ts-ignore
        await window.storage.set(key, JSON.stringify(usr), true);
        // @ts-ignore
        await window.storage.set("rpg_sess", JSON.stringify({ username: usr.username, pwHash: pw }));
        onLogin(usr);
      } else {
        if (!ex) { setErr("Usuário não encontrado."); setLoading(false); return; }
        if (ex.pwHash !== pw) { setErr("Senha incorreta."); setLoading(false); return; }
        // @ts-ignore
        await window.storage.set("rpg_sess", JSON.stringify({ username: ex.username, pwHash: pw }));
        onLogin(ex);
      }
    } catch { 
      setErr("Erro de armazenamento."); 
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "370px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ fontSize: "56px", marginBottom: "8px" }}>🎲</div>
          <h1 style={{ color: "#f59e0b", fontFamily: "Georgia", fontSize: "28px", margin: 0 }}>RPG Companion</h1>
          <p style={{ color: "#64748b", margin: "8px 0 0", fontSize: "14px" }}>Mesa Digital para Mestres e Jogadores</p>
        </div>
        <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", display: "grid", gap: "14px" }}>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>USUÁRIO</label>
            <input style={{ ...I, fontSize: "15px", padding: "10px 12px" }} value={u} onChange={e => setU(e.target.value)} placeholder="Seu nome de usuário" autoComplete="username" />
          </div>
          <div>
            <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>SENHA</label>
            <input type="password" style={{ ...I, fontSize: "15px", padding: "10px 12px" }} value={p} onChange={e => setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e => e.key === "Enter" && handle(false)} />
          </div>
          {err && <div style={{ color: "#f87171", fontSize: "13px", padding: "8px 10px", background: "#1c0a0a", borderRadius: "6px" }}>⚠️ {err}</div>}
          <button onClick={() => handle(false)} disabled={loading} style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px #f59e0b44" }}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
          <button onClick={() => handle(true)} disabled={loading} style={{ background: "transparent", color: "#60a5fa", border: "1px solid #1e40af", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: loading ? "wait" : "pointer" }}>
            Criar conta
          </button>
        </div>
      </div>
    </div>
  );
}