// src/components/RoleSelect.tsx
import { useState } from "react";
import type { User, Lobby, Character, Member } from "../types";
import { supabase } from "../lib/supabase"; // 👈 Canalizando a ponte do Supabase

const I = {
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
  padding: "10px",
  color: "#e5e7eb",
  fontSize: "14px",
  width: "100%",
  boxSizing: "border-box" as const,
};

interface RoleSelectProps {
  user: User; lobby: Lobby; chars: Character[];
  onJoin: (m: Member) => void; onCreateChar: () => void; onBack: () => void;
}

export default function RoleSelect({ user, lobby, chars, onJoin, onCreateChar, onBack }: RoleSelectProps) {
  const isLobbyOwner = lobby.ownerId === user.username;
  const [role, setRole] = useState<"mestre" | "jogador" | "espectador">(isLobbyOwner ? "mestre" : "jogador");
  const [selCharId, setSelCharId] = useState(chars[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleConfirm = async () => {
    setErr("");
    if (role === "jogador" && !selCharId) {
      setErr("Você precisa selecionar ou forjar um personagem para jogar.");
      return;
    }
    setLoading(true);

    try {
      const timestamp = Date.now();
      
      const memberData = {
        lobby_id: lobby.id,
        username: user.username,
        role: role,
        char_id: role === "jogador" ? selCharId : null,
        ts: timestamp
      };

      // 🔮 Registra a presença do jogador diretamente na tabela online 'members' (Upsert)
      const { error } = await supabase
        .from("members")
        .upsert(memberData);

      if (error) throw error;

      // Monta o objeto de membro compatível com o estado local do App.tsx
      const localMember: Member = {
        lobbyId: lobby.id,
        username: user.username,
        role: role,
        charId: role === "jogador" ? selCharId : null,
        ts: timestamp
      };
      
      // @ts-ignore - Salva o token de sessão local para reconexões automáticas rápidas
      await window.storage.set("rpg_cur", JSON.stringify(localMember));

      onJoin(localMember);
    } catch {
      setErr("Erro ao registrar presença no salão da mesa.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ width: "100%", maxWidth: "420px", background: "#1e293b", borderRadius: "14px", padding: "24px", display: "grid", gap: "16px" }}>
        
        <div>
          <button onClick={onBack} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "14px", padding: 0 }}>← Mudar de Mesa</button>
          <h2 style={{ color: "#f59e0b", margin: "8px 0 2px", fontFamily: "Georgia", fontSize: "24px" }}>Escolha seu Papel</h2>
          <p style={{ color: "#94a3b8", margin: 0, fontSize: "14px" }}>Mesa ativa: <strong style={{ color: "#e2e8f0" }}>{lobby.name}</strong></p>
        </div>

        {err && <div style={{ color: "#f87171", fontSize: "13px", padding: "10px", background: "#1c0a0a", borderRadius: "6px" }}>⚠️ {err}</div>}

        <div>
          <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "6px" }}>PAPEL NA MESA</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            <button onClick={() => setRole("mestre")} style={{ padding: "10px 4px", borderRadius: "8px", border: "none", background: role === "mestre" ? "#f59e0b" : "#111827", color: role === "mestre" ? "#111" : "#64748b", fontWeight: "bold", cursor: "pointer", fontSize: "12px", transition: "all .15s" }}>
              👑 Mestre
            </button>
            <button onClick={() => setRole("jogador")} style={{ padding: "10px 4px", borderRadius: "8px", border: "none", background: role === "jogador" ? "#3b82f6" : "#111827", color: role === "jogador" ? "#fff" : "#64748b", fontWeight: "bold", cursor: "pointer", fontSize: "12px", transition: "all .15s" }}>
              ⚔️ Jogador
            </button>
            <button onClick={() => setRole("espectador")} style={{ padding: "10px 4px", borderRadius: "8px", border: "none", background: role === "espectador" ? "#a855f7" : "#111827", color: role === "espectador" ? "#fff" : "#64748b", fontWeight: "bold", cursor: "pointer", fontSize: "12px", transition: "all .15s" }}>
              👁️ Assistir
            </button>
          </div>
        </div>

        {/* Alerta de intruso caso tente mestrar em um lobby alheio */}
        {role === "mestre" && !isLobbyOwner && (
          <div style={{ background: "#422006", border: "1px solid #f59e0b", borderRadius: "8px", padding: "10px", fontSize: "12px", color: "#f59e0b", lineHeight: "1.5" }}>
            ⚠️ <strong>Nota de Copiloto:</strong> Você não é o criador original desta sala (`{lobby.ownerId}`). Certifique-se de que possui autorização do dono da mesa para assumir a coroa de Mestre nesta sessão.
          </div>
        )}

        {role === "jogador" && (
          <div style={{ display: "grid", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold" }}>SELECIONAR HERÓI</label>
              <button onClick={onCreateChar} style={{ background: "transparent", color: "#22c55e", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "bold", padding: 0 }}>➕ Novo Herói</button>
            </div>
            
            {chars.length === 0 ? (
              <div style={{ background: "#111827", border: "1px dashed #374151", borderRadius: "8px", padding: "16px", textAlign: "center" }}>
                <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "8px" }}>Você não possui nenhum personagem para jogar.</div>
                <button onClick={onCreateChar} style={{ background: "#22c55e", color: "#111", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>Forjar Primeiro Herói</button>
              </div>
            ) : (
              <select style={I} value={selCharId} onChange={e => setSelCharId(e.target.value)}>
                {chars.map(c => (
                  <option key={c.id} value={c.id} style={{ background: "#111827" }}>
                    {c.name} (Nv. {c.nivel} - {c.classe || "Sem Classe"})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {role === "espectador" && (
          <p style={{ color: "#64748b", fontSize: "12px", margin: 0, textAlign: "center", fontStyle: "italic" }}>
            Você entrará no plano etéreo. Poderá assistir aos mapas, tokens e rolagens de dados, mas sem interagir diretamente na lona de jogo.
          </p>
        )}

        <button onClick={handleConfirm} disabled={loading || (role === "jogador" && chars.length === 0)} style={{ background: role === "mestre" ? "#f59e0b" : role === "jogador" ? "#3b82f6" : "#a855f7", color: role === "mestre" ? "#111" : "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "15px", fontWeight: "bold", cursor: (loading || (role === "jogador" && chars.length === 0)) ? "not-allowed" : "pointer", marginTop: "8px", transition: "all .2s" }}>
          {loading ? "Abrindo fenda dimensional..." : "⚔️ Confirmar Entrada"}
        </button>

      </div>
    </div>
  );
}