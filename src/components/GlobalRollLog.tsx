// src/components/GlobalRollLog.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function GlobalRollLog({ lobbyId }: { lobbyId: string }) {
  const [rolls, setRolls] = useState<any[]>([]);

  useEffect(() => {
    const canal = supabase.channel(`mesa_rolls_${lobbyId}`);
    
    canal.on("broadcast", { event: "new_roll" }, (payload) => {
      setRolls(prev => [...prev, payload.payload].slice(-5)); 
    }).subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [lobbyId]);

  useEffect(() => {
    if (rolls.length > 0) {
      const timer = setTimeout(() => {
        setRolls(prev => prev.slice(1));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [rolls]);

  if (rolls.length === 0) return null;

  return (
    <div style={{ position: "absolute", left: "20px", bottom: "90px", width: "320px", pointerEvents: "none", display: "flex", flexDirection: "column", gap: "10px", zIndex: 50 }}>
      {rolls.map(r => (
        <div key={r.id} style={{ background: "rgba(15, 23, 42, 0.9)", border: "1px solid #334155", borderLeft: r.isCrit ? "4px solid #fde047" : r.isCritFail ? "4px solid #ef4444" : "4px solid #3b82f6", borderRadius: "8px", padding: "12px 16px", color: "#e2e8f0", backdropFilter: "blur(4px)", animation: "fadeIn 0.3s ease-out", display: "flex", flexDirection: "column", gap: "6px", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
          
          {/* 👑 LINHA 1: O NOME DO JOGADOR E A AÇÃO */}
          <div style={{ fontSize: "11px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", gap: "4px" }}>
            <strong style={{ color: "#fff" }}>{r.charName}</strong> 
            <span>{r.attr ? `ROLOU ${r.attr}` : "ROLOU OS DADOS"}</span>
          </div>
          
          {/* 🧮 LINHA 2: A MATEMÁTICA CONTÍNUA */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px", fontSize: "14px", fontFamily: "monospace" }}>
            <span style={{ color: "#e2e8f0" }}>{r.dice}</span>
            
            {r.res && r.res.length > 0 && (
              <span style={{ color: "#94a3b8" }}>[{r.res.join(", ")}]</span>
            )}
            
            {r.bpd ? (
              <span style={{ color: r.bpd >= 0 ? "#4ade80" : "#fca5a5" }}>
                [{r.bpd >= 0 ? "+" : ""}{r.bpd} /dado]
              </span>
            ) : null}
            
            {r.fb ? (
              <span style={{ color: r.fb >= 0 ? "#a855f7" : "#fca5a5" }}>
                [{r.fb >= 0 ? "+" : ""}{r.fb} Fixo]
              </span>
            ) : null}
          </div>

          {/* 💥 LINHA 3: O RESULTADO TOTAL ALINHADO À DIREITA */}
          <div style={{ textAlign: "right", fontSize: "28px", fontWeight: "bold", color: r.isCrit ? "#fde047" : r.isCritFail ? "#fca5a5" : "#fff", marginTop: "-2px", textShadow: r.isCrit ? "0 0 10px rgba(253, 224, 71, 0.4)" : "none" }}>
            {r.total}
          </div>

        </div>
      ))}
    </div>
  );
}