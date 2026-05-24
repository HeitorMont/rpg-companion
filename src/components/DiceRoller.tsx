// src/components/DiceRoller.tsx
import { useState } from "react";
import type { Character } from "../types";
import { DICE, ATTRS, TC, TI, bc } from "../utils/constants";

/* ── SkillPanel (Transferido para cá) ──────────────────────────────────────── */
export function SkillPanel({ char }: { char: Character | null | undefined }) {
  const [exp, setExp] = useState<string | null>(null);
  
  if (!char?.skills?.length) return <div style={{ textAlign: "center", color: "#374151", padding: "32px" }}><div style={{ fontSize: "40px", marginBottom: "8px" }}>⚡</div>Nenhuma habilidade.</div>;
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {char.skills.map(s => (
        <div key={s.id} onClick={() => setExp(exp === s.id ? null : s.id)} style={{ background: "#1e293b", border: `1px solid ${exp === s.id ? (TC[s.type] || "#f59e0b") : "#334155"}`, borderRadius: "10px", padding: "12px", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>{TI[s.type] || "⚡"}</span>
            <span style={{ fontWeight: "bold", flex: 1 }}>{s.name}</span>
            <span style={{ background: "#0f172a", borderRadius: "10px", padding: "2px 8px", fontSize: "11px", color: TC[s.type] || "#f59e0b", fontWeight: "bold" }}>{(s.type || "").toUpperCase()}</span>
            <span style={{ color: "#64748b", fontSize: "12px" }}>{exp === s.id ? "▲" : "▼"}</span>
          </div>
          {(s.damage || s.cost || s.cooldown) && <div style={{ display: "flex", gap: "10px", marginTop: "6px", flexWrap: "wrap" }}>
            {s.damage && <span style={{ fontSize: "12px", color: "#ef4444" }}>⚔️ {s.damage}</span>}
            {s.cost && <span style={{ fontSize: "12px", color: "#3b82f6" }}>💧 {s.cost}</span>}
            {s.cooldown && <span style={{ fontSize: "12px", color: "#94a3b8" }}>⏱️ {s.cooldown}</span>}
          </div>}
          {exp === s.id && s.description && <div style={{ marginTop: "10px", padding: "10px", background: "#0f172a", borderRadius: "8px", fontSize: "13px", color: "#94a3b8", lineHeight: "1.7", borderLeft: `3px solid ${TC[s.type] || "#f59e0b"}`, whiteSpace: "pre-line" }}>{s.description}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── DiceRoller Main Component ───────────────────────── */
interface DiceRollerProps {
  activeChar: Character | null | undefined;
}

export default function DiceRoller({ activeChar }: DiceRollerProps) {
  // Estados que eram do GameScreen e agora vivem apenas aqui!
  const [num, setNum] = useState(1); 
  const [dt, setDt] = useState(20); 
  const [mb, setMb] = useState(0);
  const [atk, setAtk] = useState("none"); 
  const [rolling, setRolling] = useState(false);
  const [dispN, setDispN] = useState<number | null>(null); 
  const [lastR, setLastR] = useState<any>(null); 
  const [hist, setHist] = useState<any[]>([]);
  const [showSkills, setShowSkills] = useState(false);

  const doRoll = () => {
    if (rolling) return; setRolling(true); let i = 0;
    const iv = setInterval(() => {
      setDispN(Math.floor(Math.random() * dt) + 1);
      if (++i >= 10) {
        clearInterval(iv);
        const res = Array.from({ length: num }, () => Math.floor(Math.random() * dt) + 1);
        const sum = res.reduce((a, b) => a + b, 0);
        const ab = activeChar && atk !== "none" ? ((activeChar.bonuses as any)?.[atk] || 0) : 0;
        const bpdFinal = mb + ab, tbFinal = bpdFinal * num, total = sum + tbFinal;
        const r = { id: Date.now(), label: `${num}d${dt}`, res, mb, ab, bpd: bpdFinal, tb: tbFinal, num, total, attrL: atk !== "none" ? ATTRS.find(a => a.key === atk)?.short : null, isCrit: num === 1 && dt === 20 && res[0] === 20, isFail: num === 1 && dt === 20 && res[0] === 1, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
        setLastR(r); setDispN(total); setHist(p => [r, ...p.slice(0, 14)]); setRolling(false);
      }
    }, 55);
  };

  const currentBpd = mb + (activeChar && atk !== "none" ? ((activeChar.bonuses as any)?.[atk] || 0) : 0);
  const currentTb = currentBpd * num;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "480px", margin: "0 auto" }}>
      {activeChar && (
        <div style={{ background: "#1e293b", borderRadius: "10px", padding: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: "bold", fontSize: "15px" }}>{activeChar.name}</span>
            <span style={{ background: "#0f172a", borderRadius: "10px", padding: "1px 8px", fontSize: "11px", color: "#f59e0b" }}>Nv.{activeChar.nivel}</span>
            {activeChar.classe && <span style={{ fontSize: "12px", color: "#94a3b8" }}>{activeChar.classe}</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
            <div><div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>❤️ {activeChar.hp}/{activeChar.hpMax}</div><div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}><div style={{ background: activeChar.hp / activeChar.hpMax > .5 ? "#22c55e" : activeChar.hp / activeChar.hpMax > .25 ? "#eab308" : "#ef4444", width: `${Math.min(100, (activeChar.hp / activeChar.hpMax) * 100)}%`, height: "100%", borderRadius: "4px" }} /></div></div>
            {activeChar.vigorMax > 0 && <div><div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>⚡ {activeChar.vigor}/{activeChar.vigorMax}</div><div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}><div style={{ background: "#3b82f6", width: `${Math.min(100, (activeChar.vigor / activeChar.vigorMax) * 100)}%`, height: "100%", borderRadius: "4px" }} /></div></div>}
          </div>
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
            {ATTRS.map(a => <span key={a.key} style={{ background: "#0f172a", borderRadius: "4px", padding: "2px 5px", fontSize: "10px", color: bc((activeChar.bonuses as any)?.[a.key] || 0) }}>{a.short}: {((activeChar.bonuses as any)?.[a.key] || 0) >= 0 ? "+" : " "}{(activeChar.bonuses as any)?.[a.key] || 0}</span>)}
          </div>
        </div>
      )}
      <div style={{ background: "#1e293b", borderRadius: "10px", padding: "12px" }}>
        <label style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>TIPO DE DADO</label>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px" }}>
          {DICE.map(d => <button key={d} onClick={() => setDt(d)} style={{ background: dt === d ? "#f59e0b" : "#111827", color: dt === d ? "#111" : "#e2e8f0", border: `2px solid ${dt === d ? "#f59e0b" : "#374151"}`, borderRadius: "8px", padding: "7px 10px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", minWidth: "44px" }}>d{d}</button>)}
        </div>
      </div>
      <div style={{ background: "#1e293b", borderRadius: "10px", padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>Nº DADOS</label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            <button onClick={() => setNum(n => Math.max(1, n - 1))} style={{ background: "#111827", border: "1px solid #374151", borderRadius: "6px", color: "#e2e8f0", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px" }}>−</button>
            <span style={{ fontSize: "20px", fontWeight: "bold", minWidth: "24px", textAlign: "center" }}>{num}</span>
            <button onClick={() => setNum(n => Math.min(20, n + 1))} style={{ background: "#111827", border: "1px solid #374151", borderRadius: "6px", color: "#e2e8f0", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px" }}>+</button>
          </div>
        </div>
        <div>
          <label style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>BÔNUS/DADO</label>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            <button onClick={() => setMb(n => n - 1)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: "6px", color: "#e2e8f0", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px" }}>−</button>
            <span style={{ fontSize: "18px", fontWeight: "bold", minWidth: "30px", textAlign: "center", color: bc(mb) }}>{mb >= 0 ? "+" : " "}{mb}</span>
            <button onClick={() => setMb(n => n + 1)} style={{ background: "#111827", border: "1px solid #374151", borderRadius: "6px", color: "#e2e8f0", width: "30px", height: "30px", cursor: "pointer", fontSize: "16px" }}>+</button>
          </div>
        </div>
      </div>
      {activeChar && (
        <div style={{ background: "#1e293b", borderRadius: "10px", padding: "12px" }}>
          <label style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>ATRIBUTO (bônus/dado)</label>
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "8px" }}>
            <button onClick={() => setAtk("none")} style={{ background: atk === "none" ? "#f59e0b" : "#111827", color: atk === "none" ? "#111" : "#e2e8f0", border: `1px solid ${atk === "none" ? "#f59e0b" : "#374151"}`, borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "12px" }}>Nenhum</button>
            {ATTRS.map(a => { const bv = (activeChar.bonuses as any)?.[a.key] || 0; return (
              <button key={a.key} onClick={() => setAtk(a.key)} style={{ background: atk === a.key ? "#f59e0b" : "#111827", color: atk === a.key ? "#111" : "#e2e8f0", border: `1px solid ${atk === a.key ? "#f59e0b" : "#374151"}`, borderRadius: "6px", padding: "4px 7px", cursor: "pointer", fontSize: "11px", display: "flex", gap: "3px", alignItems: "center" }}>
                {a.short}<span style={{ fontWeight: "bold", color: atk === a.key ? "#333" : bc(bv) }}>{bv >= 0 ? "+" : ""}{bv}</span>
              </button>
            ); })}
          </div>
        </div>
      )}
      <div style={{ background: "#1e293b", borderRadius: "12px", padding: "16px", textAlign: "center" }}>
        <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "2px" }}>
          {num}d{dt}{currentBpd !== 0 && <span style={{ color: currentBpd >= 0 ? "#4ade80" : "#f87171" }}> ({currentBpd >= 0 ? "+" : ""}{currentBpd} × {num} = {currentTb >= 0 ? "+" : ""}{currentTb})</span>}
        </div>
        <div style={{ fontSize: dispN !== null && String(dispN).length > 3 ? "50px" : "68px", fontWeight: "bold", fontFamily: "Georgia", minHeight: "84px", display: "flex", alignItems: "center", justifyContent: "center", color: lastR?.isCrit ? "#fbbf24" : lastR?.isFail ? "#ef4444" : "#f1f5f9", textShadow: lastR?.isCrit ? "0 0 24px #fbbf24" : "none" }}>
          {dispN !== null ? dispN : "—"}
        </div>
        {lastR && !rolling && (
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px" }}>
            {lastR.isCrit && <div style={{ color: "#fbbf24", fontWeight: "bold" }}>⭐ CRÍTICO! ⭐</div>}
            {lastR.isFail && <div style={{ color: "#ef4444", fontWeight: "bold" }}>💀 FALHA CRÍTICA!</div>}
            <div>[{lastR.res.join(", ")}]{lastR.bpd !== 0 && ` +(${lastR.bpd}×${lastR.num}=${lastR.tb})`}</div>
          </div>
        )}
        <button onClick={doRoll} disabled={rolling} style={{ background: rolling ? "#374151" : "#f59e0b", color: rolling ? "#64748b" : "#111", border: "none", borderRadius: "10px", padding: "12px", fontSize: "17px", fontWeight: "bold", cursor: rolling ? "not-allowed" : "pointer", width: "100%", boxShadow: rolling ? "none" : "0 4px 14px #f59e0b55" }}>
          {rolling ? "🎲 Rolando..." : "🎲 Rolar!"}
        </button>
      </div>
      {activeChar && activeChar.skills && activeChar.skills.length > 0 && (
        <div style={{ background: "#1e293b", borderRadius: "10px", padding: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setShowSkills(s => !s)}>
            <span style={{ color: "#a855f7", fontSize: "13px", fontWeight: "bold" }}>⚡ Habilidades</span>
            <span style={{ color: "#64748b", fontSize: "12px" }}>{showSkills ? "▲" : "▼"} ({activeChar.skills.length})</span>
          </div>
          {showSkills && <div style={{ marginTop: "10px" }}><SkillPanel char={activeChar} /></div>}
        </div>
      )}
      {hist.length > 0 && (
        <div style={{ background: "#1e293b", borderRadius: "10px", padding: "12px" }}>
          <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "6px" }}>HISTÓRICO</div>
          {hist.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 6px", borderRadius: "6px", background: i === 0 ? "#111827" : "transparent", marginBottom: "2px", opacity: Math.max(.4, 1 - i * .06) }}>
              <span style={{ fontSize: "11px", color: "#475569", minWidth: "34px" }}>{r.time}</span>
              <span style={{ fontSize: "12px", color: "#94a3b8" }}>{r.label}</span>
              {r.attrL && <span style={{ fontSize: "11px", color: "#60a5fa" }}>({r.attrL})</span>}
              {r.bpd !== 0 && <span style={{ fontSize: "11px", color: "#64748b" }}>{r.bpd >= 0 ? "+" : ""}{r.bpd}×{r.num}</span>}
              <span style={{ marginLeft: "auto", fontWeight: "bold", fontSize: "16px", color: r.isCrit ? "#fbbf24" : r.isFail ? "#ef4444" : "#f1f5f9" }}>{r.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}