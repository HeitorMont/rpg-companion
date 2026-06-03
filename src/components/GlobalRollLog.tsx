// src/components/GlobalRollLog.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function GlobalRollLog({ lobbyId }: { lobbyId: string }) {
  const [rolls, setRolls] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    // ⚔️ TRUQUE DE MESTRE: Ativamos 'self: true' para que o Supabase envie as nossas rolagens de volta para nós
    const canal = supabase.channel(`mesa_rolls_${lobbyId}`, {
      config: { broadcast: { self: true } },
    });
    
    canal.on("broadcast", { event: "new_roll" }, (payload) => {
      setRolls(prev => {
        const incoming = payload.payload;
        
        // Evita duplicados na lista caso o cliente envie e receba ao mesmo tempo
        if (incoming.id && prev.some(r => r.id === incoming.id)) {
          return prev;
        }
        
        // Adiciona no topo do histórico (índice 0)
        return [incoming, ...prev].slice(0, 50);
      }); 
      
      setHasNew(true);
    }).subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [lobbyId]);

  // Limpa a notificação de novos dados assim que o utilizador abre a janela
  useEffect(() => {
    if (isOpen) {
      setHasNew(false);
    }
  }, [isOpen]);

  return (
    <div 
      style={{ 
        position: "absolute", 
        left: "20px", 
        bottom: "90px", 
        zIndex: 60, 
        display: "flex", 
        flexDirection: "column-reverse", 
        gap: "8px",
        pointerEvents: "none" 
      }}
    >
      
      {/* 🎲 BOTÃO FLUTUANTE PARA ABRIR/FECHAR O HISTÓRICO */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          pointerEvents: "auto",
          background: "#1e3a5f",
          color: "#60a5fa",
          border: "1px solid #1e40af",
          borderRadius: "8px",
          padding: "8px 14px",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "bold",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          width: "fit-content",
          position: "relative",
          userSelect: "none",
          transition: "background 0.2s"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#1d4ed8")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#1e3a5f")}
      >
        🎲 {isOpen ? "Ocultar Dados" : "Histórico de Dados"}
        
        {/* Notificação vermelha pulsante caso chegue dado com a janela fechada */}
        {!isOpen && hasNew && (
          <span 
            style={{
              position: "absolute",
              top: "-3px",
              right: "-3px",
              background: "#ef4444",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              boxShadow: "0 0 8px #ef4444",
              animation: "pulseNotification 1.2s infinite"
            }} 
          />
        )}
      </button>

      {/* 📜 JANELA DO CHAT DE HISTÓRICO ROLÁVEL */}
      {isOpen && (
        <div
          style={{
            pointerEvents: "auto",
            width: "320px",
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid #334155",
            borderRadius: "12px",
            boxShadow: "0 12px 24px rgba(0,0,0,0.6)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "slideUpFade 0.25s ease-out"
          }}
        >
          {/* TOPO DA JANELA: Título e Ação de Limpar Localmente */}
          <div style={{ background: "#0f172a", padding: "10px 14px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#f59e0b", fontSize: "11px", fontWeight: "bold", letterSpacing: "0.5px" }}>
              📜 LOG DE ROLAGENS ({rolls.length})
            </span>
            {rolls.length > 0 && (
              <button
                onClick={() => setRolls([])}
                style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "11px", transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
              >
                Limpar
              </button>
            )}
          </div>

          {/* CORPO DA JANELA: Área interna com Scroll Sincronizado */}
          <div
            style={{
              padding: "10px",
              maxHeight: "280px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            {rolls.length === 0 ? (
              <div style={{ color: "#475569", fontSize: "12px", textAlign: "center", padding: "30px 10px", fontFamily: "sans-serif" }}>
                Nenhuma jogada registrada nesta sessão.
              </div>
            ) : (
              rolls.map((r, idx) => (
                <div 
                  key={r.id || idx} 
                  style={{ 
                    background: "rgba(30, 41, 59, 0.4)", 
                    border: "1px solid #1e293b", 
                    borderLeft: r.isCrit ? "4px solid #fde047" : r.isCritFail ? "4px solid #ef4444" : "4px solid #3b82f6", 
                    borderRadius: "8px", 
                    padding: "8px 12px", 
                    color: "#e2e8f0", 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "4px" 
                  }}
                >
                  {/* Informações do Personagem e Atributo */}
                  <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "#fff" }}>{r.charName}</strong> 
                      <span style={{ fontSize: "10px", color: "#64748b", marginLeft: "4px" }}>
                        {r.attr ? `• ${r.attr}` : ""}
                      </span>
                    </div>
                    {r.isCrit && <span style={{ color: "#fde047", fontWeight: "bold", fontSize: "10px" }}>⭐ CRÍTICO</span>}
                    {r.isCritFail && <span style={{ color: "#fca5a5", fontWeight: "bold", fontSize: "10px" }}>💀 FALHA</span>}
                  </div>
                  
                  {/* Linha Matemática + Resultado Unificados Horizontalmente */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", fontSize: "12px", fontFamily: "monospace" }}>
                      <span style={{ color: "#cbd5e1" }}>{r.dice}</span>
                      {r.res && r.res.length > 0 && (
                        <span style={{ color: "#64748b" }}>[{r.res.join(",")}]</span>
                      )}
                      {r.bpd ? <span style={{ color: r.bpd >= 0 ? "#4ade80" : "#fca5a5" }}>({r.bpd >= 0 ? "+" : ""}{r.bpd}/d)</span> : null}
                      {r.fb ? <span style={{ color: r.fb >= 0 ? "#a855f7" : "#fca5a5" }}>({r.fb >= 0 ? "+" : ""}{r.fb}F)</span> : null}
                    </div>

                    <div style={{ fontSize: "20px", fontWeight: "bold", color: r.isCrit ? "#fde047" : r.isCritFail ? "#fca5a5" : "#fff", textShadow: r.isCrit ? "0 0 8px rgba(253, 224, 71, 0.3)" : "none" }}>
                      {r.total}
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 🔮 ANIMAÇÕES INJETADAS */}
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseNotification {
          0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>

    </div>
  );
}