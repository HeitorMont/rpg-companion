// src/components/LoginScreen.tsx
import { useState } from "react";
import type { User } from "../types";
import { supabase } from "../lib/supabase"; // 👈 Invocando a ponte oficial do Supabase

export const hashPw = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
};

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

type ScreenMode = "login" | "register" | "success";

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode] = useState<ScreenMode>("login");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [confirmP, setConfirmP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const clearForm = () => {
    setU("");
    setP("");
    setConfirmP("");
    setErr("");
  };

  const handleLogin = async () => {
    setErr("");
    if (!u.trim() || !p.trim()) { setErr("Preencha todos os campos."); return; }
    setLoading(true);
    
    const usernameLower = u.trim().toLowerCase();
    const pw = hashPw(p);
    
    try {
      // 🔮 Consulta real na tabela online do PostgreSQL
      const { data: ex, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", usernameLower)
        .maybeSingle();

      if (error) throw error;
      
      if (!ex) { setErr("Usuário não encontrado."); setLoading(false); return; }
      if (ex.pw_hash !== pw) { setErr("Senha incorreta."); setLoading(false); return; }
      
      await window.storage.set("rpg_sess", JSON.stringify({ username: ex.username, pwHash: pw }));
      
      // Converte o retorno do banco para o tipo User do TypeScript
      onLogin({ username: ex.username, pwHash: ex.pw_hash, createdAt: ex.created_at });
    } catch { 
      setErr("Erro de conexão com o servidor online."); 
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setErr("");
    if (!u.trim() || !p.trim() || !confirmP.trim()) { setErr("Preencha todos os campos."); return; }
    if (u.trim().length < 3) { setErr("Usuário: mínimo 3 caracteres."); return; }
    if (p.length < 4) { setErr("Senha: mínimo 4 caracteres."); return; }
    if (p !== confirmP) { setErr("As senhas informadas não coincidem."); return; }
    setLoading(true);
    
    const usernameLower = u.trim().toLowerCase();
    const pw = hashPw(p);
    
    try {
      // 🔮 Verifica em tempo real na nuvem se o nome já foi pego
      const { data: ex, error: checkError } = await supabase
        .from("users")
        .select("username")
        .eq("username", usernameLower)
        .maybeSingle();

      if (checkError) throw checkError;
      if (ex) { setErr("Usuário já existe. Escolha outro nome."); setLoading(false); return; }
      
      // 🔮 Insere as runas do novo jogador direto no banco online
      const { error: insertError } = await supabase
        .from("users")
        .insert([{ username: usernameLower, pw_hash: pw, created_at: Date.now() }]);

      if (insertError) throw insertError;
      
      setMode("success");
      setP("");
      setConfirmP("");
      setErr("");
    } catch { 
      setErr("Erro ao forjar a conta no servidor online."); 
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

        {/* JANELA 1: LOGIN */}
        {mode === "login" && (
          <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", display: "grid", gap: "14px" }}>
            <h2 style={{ color: "#f59e0b", margin: "0 0 2px", fontSize: "18px", fontFamily: "Georgia" }}>Entrar na Sessão</h2>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>USUÁRIO</label>
              <input style={{ ...I, fontSize: "15px", padding: "10px 12px" }} value={u} onChange={e => setU(e.target.value)} placeholder="Seu nome de usuário" autoComplete="username" />
            </div>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>SENHA</label>
              <input type="password" style={{ ...I, fontSize: "15px", padding: "10px 12px" }} value={p} onChange={e => setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            {err && <div style={{ color: "#f87171", fontSize: "13px", padding: "8px 10px", background: "#1c0a0a", borderRadius: "6px" }}>⚠️ {err}</div>}
            
            <button onClick={handleLogin} disabled={loading} style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px #f59e0b44" }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
            
            <div style={{ textAlign: "center", borderTop: "1px solid #334155", paddingTop: "14px", marginTop: "4px" }}>
              <button onClick={() => { setMode("register"); clearForm(); }} style={{ background: "transparent", color: "#60a5fa", border: "none", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}>
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
              <input style={{ ...I, fontSize: "15px", padding: "10px 12px" }} value={u} onChange={e => setU(e.target.value)} placeholder="Mínimo de 3 caracteres" autoComplete="username" />
            </div>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>SENHA MÁGICA</label>
              <input type="password" style={{ ...I, fontSize: "15px", padding: "10px 12px" }} value={p} onChange={e => setP(e.target.value)} placeholder="Mínimo de 4 caracteres" autoComplete="new-password" />
            </div>
            <div>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>CONFIRMAR SENHA</label>
              <input type="password" style={{ ...I, fontSize: "15px", padding: "10px 12px" }} value={confirmP} onChange={e => setConfirmP(e.target.value)} placeholder="Repita a senha para validação" autoComplete="new-password" onKeyDown={e => e.key === "Enter" && handleRegister()} />
            </div>
            {err && <div style={{ color: "#f87171", fontSize: "13px", padding: "8px 10px", background: "#1c0a0a", borderRadius: "6px" }}>⚠️ {err}</div>}
            
            <button onClick={handleRegister} disabled={loading} style={{ background: "#22c55e", color: "#111", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: loading ? "wait" : "pointer", boxShadow: "0 4px 14px #22c55e44" }}>
              {loading ? "Gravando no banco..." : "⚔️ Confirmar Criação"}
            </button>
            
            <button onClick={() => { setMode("login"); clearForm(); }} style={{ background: "transparent", color: "#64748b", border: "1px solid #374151", borderRadius: "8px", padding: "12px", fontSize: "14px", cursor: "pointer" }}>
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
              As crônicas da taverna foram salvas na nuvem. O usuário <strong style={{ color: "#e2e8f0" }}>{u}</strong> está pronto para iniciar sua jornada.
            </p>
            <button onClick={() => { setMode("login"); clearForm(); }} style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 14px #f59e0b44" }}>
              Avançar para o Login →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}