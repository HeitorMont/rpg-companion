// src/components/CharacterList.tsx
import { useState } from "react";
import type { Character, Member, User } from "../types";
import { ATTRS, bc } from "../utils/constants";

interface CharacterListProps {
  chars: Character[];
  member: Member;
  user: User;
  isMestre: boolean;
  onDeleteChar: (id: string) => Promise<void> | void;
  onEditChar: (c: Character) => void;
}

export default function CharacterList({ chars, member, user, isMestre, onDeleteChar, onEditChar }: CharacterListProps) {
  // O estado de deletar agora vive apenas aqui!
  const [delC, setDelC] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      <h2 style={{ color: "#f59e0b", fontFamily: "Georgia", margin: "0 0 14px" }}>Personagens</h2>
      {chars.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#374151" }}>
          <div style={{ fontSize: "40px" }}>⚔️</div>
          <div>Nenhum personagem.</div>
        </div>
      )}
      {chars.map(c => (
        <div key={c.id} style={{ background: "#1e293b", border: `2px solid ${member.charId === c.id ? "#3b82f6" : "#334155"}`, borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
          {delC === c.id ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ color: "#f87171", flex: 1 }}>Deletar <strong>{c.name}</strong>?</span>
              <button 
                onClick={async () => { 
                  try {
                    await onDeleteChar(c.id);
                    setDelC(null);
                  } catch (err) {
                    console.error("Falha ao deletar personagem:", err);
                    alert("Não foi possível deletar o personagem. Tente novamente.");
                  }
                }}
                style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}
              >Sim</button>
              <button onClick={() => setDelC(null)} style={{ background: "#374151", color: "#e2e8f0", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer" }}>Não</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: "bold", fontSize: "15px" }}>{c.name}</span>
                  <span style={{ background: "#0f172a", borderRadius: "10px", padding: "1px 8px", fontSize: "11px", color: "#f59e0b" }}>Nv.{c.nivel}</span>
                  {c.classe && <span style={{ fontSize: "12px", color: "#94a3b8" }}>{c.classe}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>❤️ {c.hp}/{c.hpMax}</div>
                    <div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}>
                      <div style={{ background: c.hp / c.hpMax > .5 ? "#22c55e" : c.hp / c.hpMax > .25 ? "#eab308" : "#ef4444", width: `${Math.min(100, (c.hp / c.hpMax) * 100)}%`, height: "100%", borderRadius: "4px" }} />
                    </div>
                  </div>
                  {c.vigorMax > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>⚡ {c.vigor}/{c.vigorMax}</div>
                      <div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}>
                        <div style={{ background: "#3b82f6", width: `${Math.min(100, (c.vigor / c.vigorMax) * 100)}%`, height: "100%", borderRadius: "4px" }} />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                  {ATTRS.map(a => (
                    <span key={a.key} style={{ background: "#0f172a", borderRadius: "4px", padding: "2px 5px", fontSize: "10px", color: bc((c.bonuses as any)[a.key] || 0) }}>
                      {a.short}: {((c.bonuses as any)[a.key] || 0) >= 0 ? "+" : " "}{(c.bonuses as any)[a.key] || 0}
                    </span>
                  ))}
                </div>
              </div>
              {!isMestre && c.owner === user.username && (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: "70px" }}>
                  <button onClick={() => onEditChar(c)} style={{ background: "#111827", color: "#94a3b8", border: "1px solid #374151", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }}>✏️</button>
                  <button onClick={() => setDelC(c.id)} style={{ background: "#111827", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}