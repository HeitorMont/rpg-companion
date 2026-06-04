// src/components/SessionPanel.tsx
import { memo } from "react";
import type { Lobby, Member, Character, User } from "../types";
import { I } from "../utils/constants";


interface SessionPanelProps {
  lobby: Lobby;
  member: Member;
  user: User;
  chars: Character[];
  members: Member[];
  isAnotherMasterActive: boolean;
  onSwitchRole: (newRole: "mestre" | "jogador" | "espectador", chosenCharId: string | null) => Promise<void> | void;
  onLeave: () => void;
}

const SessionPanel = memo(function SessionPanel({ lobby, member, user, chars, members, isAnotherMasterActive, onSwitchRole, onLeave }: SessionPanelProps) {
  return (
    <div style={{ maxWidth: "460px", margin: "0 auto" }}>
      <h2 style={{ color: "#f59e0b", fontFamily: "Georgia", margin: "0 0 14px" }}>👥 {lobby.name}</h2>

      <div style={{ background: "#1e293b", borderRadius: "12px", padding: "14px", marginBottom: "14px", display: "grid", gap: "10px", border: "1px solid #334155" }}>
        <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>⚡ TRANSMUTAR SEU PAPEL ATUAL</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
          <button onClick={() => onSwitchRole("mestre", null)} disabled={isAnotherMasterActive} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "mestre" ? "#f59e0b" : "#111827", color: member.role === "mestre" ? "#111" : isAnotherMasterActive ? "#374151" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: isAnotherMasterActive ? "not-allowed" : "pointer", opacity: isAnotherMasterActive ? 0.4 : 1 }}>👑 Mestre</button>
          <button onClick={() => onSwitchRole("espectador", null)} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "espectador" ? "#a855f7" : "#111827", color: member.role === "espectador" ? "#fff" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>👁️ Assistir</button>
          <button onClick={() => { if (chars.length > 0) onSwitchRole("jogador", member.charId || chars[0].id); else alert("Forje um herói na Armaria primeiro!"); }} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "jogador" ? "#3b82f6" : "#111827", color: member.role === "jogador" ? "#fff" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>⚔️ Jogador</button>
        </div>
        {isAnotherMasterActive && <div style={{ color: "#f87171", fontSize: "11px", fontStyle: "italic", textAlign: "center" }}>⚠️ O Trono do Mestre já está ocupado.</div>}
        {member.role === "jogador" && chars.length > 1 && (
          <div style={{ display: "grid", gap: "4px", marginTop: "4px", borderTop: "1px solid #334155", paddingTop: "8px" }}>
            <label style={{ color: "#9ca3af", fontSize: "10px", fontWeight: "bold" }}>MUDAR DE HERÓI ATIVO:</label>
            <select style={{ ...I, padding: "6px", fontSize: "12px" }} value={member.charId || ""} onChange={e => onSwitchRole("jogador", e.target.value)}>
              {chars.map(c => <option key={c.id} value={c.id} style={{ background: "#111827" }}>{c.name} (Nv. {c.nivel} - {c.classe})</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ background: "#1e293b", borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
        <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "10px" }}>PARTICIPANTES ONLINE ({members.length})</div>
        {members.length === 0 && <div style={{ color: "#374151", fontSize: "13px", textAlign: "center", padding: "16px" }}>Ninguém mais na sessão.</div>}
        {members.map(m => (
          <div key={m.username} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", background: "#0f172a", borderRadius: "8px", marginBottom: "6px" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: m.color, boxShadow: `0 0 8px ${m.color}55`, flexShrink: 0 }} />
            <span style={{ fontSize: "18px" }}>{m.role === "mestre" ? "👑" : m.role === "espectador" ? "👁️" : "⚔️"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold", fontSize: "14px" }}>{m.username}{m.username === user.username ? " (você)" : ""}</div>
              <div style={{ fontSize: "11px", color: "#64748b", textTransform: "capitalize" }}>{m.role}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onLeave} style={{ background: "#1c0a0a", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "8px", padding: "10px", cursor: "pointer", fontWeight: "bold", width: "100%" }}>🚪 Sair do Lobby</button>
    </div>
  );
});

export default SessionPanel;