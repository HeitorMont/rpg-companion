// src/components/RoleSelect.tsx
import { useState, useEffect, useCallback } from "react";
import type { User, Lobby, Character, Member } from "../types";

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

interface RoleSelectProps {
  user: User;
  lobby: Lobby;
  chars: Character[];
  onJoin: (m: Member) => void;
  onCreateChar: () => void;
  onBack: () => void;
}

export default function RoleSelect({ user, lobby, chars, onJoin, onCreateChar, onBack }: RoleSelectProps) {
  const [role, setRole] = useState("jogador");
  const [charId, setCharId] = useState(chars[0]?.id || "");
  const [err, setErr] = useState("");
  const [members, setMembers] = useState<Member[]>([]);

  const loadM = useCallback(async () => {
    try {
      // @ts-ignore
      const r = await window.storage.list(`rpg_mem:${lobby.id}:`, true);
      if (r?.keys?.length) {
        // @ts-ignore
        const ms = (await Promise.all(r.keys.map(async (k: string) => { try { const d = await window.storage.get(k, true); return d ? JSON.parse(d.value) : null; } catch { return null; } }))).filter(Boolean).filter((m: Member) => Date.now() - m.ts < 120000);
        setMembers(ms);
      } else {
        setMembers([]);
      }
    } catch {}
  }, [lobby.id]);

  useEffect(() => {
    loadM();
    const iv = setInterval(loadM, 5000);
    return () => clearInterval(iv);
  }, [loadM]);

  const hasMaster = members.some(m => m.role === "mestre");

  const join = async () => {
    if (role === "mestre" && hasMaster) { setErr("Já existe um Mestre!"); return; }
    if (role === "jogador" && !charId) { setErr("Selecione um personagem!"); return; }
    
    const mem: Member = {
      username: user.username,
      role,
      charId: role === "jogador" ? charId : null,
      lobbyId: lobby.id,
      ts: Date.now()
    };
    
    try {
      // @ts-ignore
      await window.storage.set(`rpg_mem:${lobby.id}:${user.username}`, JSON.stringify(mem), true);
      // @ts-ignore
      await window.storage.set("rpg_cur", JSON.stringify({ username: user.username, lobbyId: lobby.id, role, charId: mem.charId }));
    } catch {}
    onJoin(mem);
  };

  const ROLES = [
    ["mestre", "👑", "Mestre", "Narra e controla o mapa", hasMaster],
    ["jogador", "⚔️", "Jogador", "Controla personagem", false],
    ["espectador", "👁️", "Espectador", "Assiste a sessão", false],
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div style={{ width: "100%", maxWidth: "440px" }}>
        <button onClick={onBack} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", marginBottom: "14px", fontSize: "14px" }}>← Lobbies</button>
        <div style={{ background: "#1e293b", borderRadius: "14px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid #334155" }}>
            <span style={{ fontSize: "24px" }}>🎲</span>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "16px" }}>{lobby.name}</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>por {lobby.ownerId}</div>
            </div>
          </div>
          {members.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>NA SESSÃO</div>
              {members.map(m => (
                <div key={m.username} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
                  <span>{m.role === "mestre" ? "👑" : m.role === "espectador" ? "👁️" : "⚔️"}</span>
                  <span style={{ fontSize: "13px" }}>{m.username}</span>
                  <span style={{ fontSize: "11px", color: "#64748b", background: "#0f172a", borderRadius: "10px", padding: "1px 6px" }}>{m.role}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBottom: "12px" }}>
            <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "8px" }}>ESCOLHER PAPEL</div>
            {ROLES.map(([r, ico, lbl, sub, dis]) => (
              <button key={r as string} onClick={() => { if (!dis) { setRole(r as string); setErr(""); } }} style={{
                background: role === r ? "#1e3a5f" : "#111827", border: `2px solid ${role === r ? "#3b82f6" : dis ? "#2d1a0e" : "#374151"}`,
                borderRadius: "10px", padding: "10px 14px", cursor: dis ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "12px", width: "100%", marginBottom: "6px", opacity: dis && role !== r ? 0.5 : 1,
              }}>
                <span style={{ fontSize: "22px" }}>{ico as string}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ color: role === r ? "#60a5fa" : "#e2e8f0", fontWeight: "bold", fontSize: "14px" }}>{lbl as string}{dis ? " (ocupado)" : ""}</div>
                  <div style={{ color: "#64748b", fontSize: "11px" }}>{sub as string}</div>
                </div>
              </button>
            ))}
          </div>
          {role === "jogador" && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>PERSONAGEM</div>
              {chars.length > 0 ? (
                <>
                  <select style={{ ...I, marginBottom: "8px" }} value={charId} onChange={e => setCharId(e.target.value)}>
                    <option value="">— Selecione —</option>
                    {chars.map(c => <option key={c.id} value={c.id}>{c.name} ({c.classe || "?"} Nv.{c.nivel})</option>)}
                  </select>
                  <button onClick={onCreateChar} style={{ background: "transparent", color: "#60a5fa", border: "1px dashed #1e40af", borderRadius: "8px", padding: "7px", width: "100%", cursor: "pointer", fontSize: "12px" }}>+ Criar novo personagem</button>
                </>
              ) : <button onClick={onCreateChar} style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #1e40af", borderRadius: "8px", padding: "10px", width: "100%", cursor: "pointer", fontSize: "14px", fontWeight: "bold" }}>⚔️ Criar personagem primeiro</button>}
            </div>
          )}
          {err && <div style={{ color: "#f87171", fontSize: "13px", padding: "8px", background: "#1c0a0a", borderRadius: "6px", marginBottom: "10px" }}>⚠️ {err}</div>}
          <button onClick={join} style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "10px", padding: "13px", width: "100%", fontSize: "16px", fontWeight: "bold", cursor: "pointer", boxShadow: "0 4px 14px #f59e0b44" }}>🎲 Entrar</button>
        </div>
      </div>
    </div>
  );
}