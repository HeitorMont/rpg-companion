// src/components/GameScreen.tsx
import { useState, useEffect } from "react";
import type { User, Lobby, Character, Member } from "../types";
import { useCanvas } from "../hooks/useCanvas";
import { supabase } from "../lib/supabase"; 
import CharEditor from "./CharEditor";

const DICE = [4, 6, 8, 10, 12, 20, 100];
const ATTRS = [
  { key: "for", short: "FOR", label: "Força" }, { key: "des", short: "DES", label: "Destreza" },
  { key: "con", short: "CON", label: "Constituição" }, { key: "int", short: "INT", label: "Inteligência" },
  { key: "sab", short: "SAB", label: "Sabedoria" }, { key: "car", short: "CAR", label: "Carisma" },
  { key: "sob", short: "SOB", label: "Sobrevivência" }, { key: "sor", short: "SOR", label: "Sorte" },
  { key: "fe", short: "FÉ", label: "Fé" },
];
const PAL = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ffffff", "#94a3b8"];
const TC: Record<string, string> = { passiva: "#60a5fa", ativa: "#f59e0b", ataque: "#ef4444", especial: "#a855f7" };
const TI: Record<string, string> = { passiva: "🛡️", ativa: "⚡", ataque: "⚔️", especial: "✨" };

const bc = (v: number) => (v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#475569");

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

/* ── SkillPanel ──────────────────────────────────────── */
function SkillPanel({ char }: { char: Character | null }) {
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

/* ── GameScreen Main Component ───────────────────────── */
interface GameScreenProps {
  user: User; lobby: Lobby; member: Member; chars: Character[];
  onLeave: () => void; onSaveChar: (c: Character) => Promise<void> | void; onDeleteChar: (id: string) => Promise<void> | void;
  onUpdateMember: (m: Member) => void; 
}

export default function GameScreen({ user, lobby, member, chars, onLeave, onSaveChar, onDeleteChar, onUpdateMember }: GameScreenProps) {
  const isMestre = member.role === "mestre"; const isEsp = member.role === "espectador";
  const activeChar = member.charId ? chars.find(c => c.id === member.charId) : null;

  const TABS = isMestre
    ? [["dados", "🎲"], ["mestre", "🗺️"], ["sessao", "👥"]]
    : isEsp ? [["tela", "🗺️"], ["sessao", "👥"]] : [["dados", "🎲"], ["personagens", "⚔️"], ["tela", "🗺️"], ["sessao", "👥"]];
  const TLABELS: Record<string, string> = { dados: "Dados", personagens: "Chars", mestre: "Mestre", sessao: "Sessão", habilidades: "Skills", tela: "Tela" };

  const [tab, setTab] = useState(TABS[0][0]); const [members, setMembers] = useState<Member[]>([]);
  const [editChar, setEditChar] = useState<Character | null>(null); const [showCE, setShowCE] = useState(false);
  const [delC, setDelC] = useState<string | null>(null); const [showSkills, setShowSkills] = useState(false);

  const [num, setNum] = useState(1); const [dt, setDt] = useState(20); const [mb, setMb] = useState(0);
  const [atk, setAtk] = useState("none"); const [rolling, setRolling] = useState(false);
  const [dispN, setDispN] = useState<number | null>(null); const [lastR, setLastR] = useState<any>(null); const [hist, setHist] = useState<any[]>([]);

  const cv = useCanvas(lobby.id, isMestre, tab);

  useEffect(() => {
    const pingOnline = async () => {
      try {
        await supabase
          .from("members")
          .upsert({
            lobby_id: lobby.id,
            username: user.username,
            role: member.role,
            char_id: member.charId || null,
            ts: Date.now()
          });
      } catch {}
    };
    pingOnline(); const iv = setInterval(pingOnline, 20000); return () => clearInterval(iv);
  }, [lobby.id, member, user.username]);

  const fetchActiveMembers = async () => {
    try {
      const { data } = await supabase
        .from("members")
        .select("*")
        .eq("lobby_id", lobby.id);
      
      if (data) {
        const active = data
          .filter((m: any) => Date.now() - m.ts < 40000)
          .map((m: any) => ({
            lobbyId: m.lobby_id,
            username: m.username,
            role: m.role,
            charId: m.char_id,
            ts: m.ts
          }));
        setMembers(active);
      }
    } catch {}
  };

  useEffect(() => {
    fetchActiveMembers();
    
    const canalPresenca = supabase
      .channel(`lobby_members:${lobby.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `lobby_id=eq.${lobby.id}` },
        () => { fetchActiveMembers(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(canalPresenca); };
  }, [lobby.id]);

  const handleSwitchRoleInsideGame = async (newRole: "mestre" | "jogador" | "espectador", chosenCharId: string | null) => {
    try {
      const timestamp = Date.now();
      const updatedMemberData = {
        lobby_id: lobby.id,
        username: user.username,
        role: newRole,
        char_id: newRole === "jogador" ? chosenCharId : null,
        ts: timestamp
      };

      const { error } = await supabase
        .from("members")
        .upsert(updatedMemberData);

      if (error) throw error;

      const localMemberObj: Member = {
        lobbyId: lobby.id,
        username: user.username,
        role: newRole,
        charId: newRole === "jogador" ? chosenCharId : null,
        ts: timestamp
      };

      await window.storage.set("rpg_cur", JSON.stringify(localMemberObj));
      onUpdateMember(localMemberObj);

      const allowed = newRole === "mestre" 
        ? ["dados", "mestre", "sessao"]
        : newRole === "espectador" ? ["tela", "sessao"] : ["dados", "personagens", "tela", "sessao"];
      
      if (!allowed.includes(tab)) {
        setTab(allowed[0]);
      }
    } catch {
      alert("⚠️ Erro ao transmutar papel no servidor.");
    }
  };

  const doRoll = () => {
    if (rolling) return; setRolling(true); let i = 0;
    const iv = setInterval(() => {
      setDispN(Math.floor(Math.random() * dt) + 1);
      if (++i >= 10) {
        clearInterval(iv);
        const res = Array.from({ length: num }, () => Math.floor(Math.random() * dt) + 1);
        const sum = res.reduce((a, b) => a + b, 0);
        const ab = activeChar && atk !== "none" ? ((activeChar.bonuses as any)[atk] || 0) : 0;
        const bpdFinal = mb + ab, tbFinal = bpdFinal * num, total = sum + tbFinal;
        const r = { id: Date.now(), label: `${num}d${dt}`, res, mb, ab, bpd: bpdFinal, tb: tbFinal, num, total, attrL: atk !== "none" ? ATTRS.find(a => a.key === atk)?.short : null, isCrit: num === 1 && dt === 20 && res[0] === 20, isFail: num === 1 && dt === 20 && res[0] === 1, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
        setLastR(r); setDispN(total); setHist(p => [r, ...p.slice(0, 14)]); setRolling(false);
      }
    }, 55);
  };

  const currentBpd = mb + (activeChar && atk !== "none" ? ((activeChar.bonuses as any)[atk] || 0) : 0);
  const currentTb = currentBpd * num;
  const saveChar = async (c: Character) => { await onSaveChar(c); setShowCE(false); setEditChar(null); };

  const canvasPanelJSX = (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 110px)" }}>
      {isMestre && (
        <div style={{ background: "#1e293b", padding: "8px 10px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #334155" }}>
          {[["pan", "🖐️ Arrastar"], ["select", "🖱️ Selecionar"], ["pen", "✏️ Caneta"], ["eraser", "⬜ Borracha"]].map(([t, l]) => (
            <button key={t} onClick={() => { cv.setTool(t); if (t !== "select") cv.setSelImg([]); }} style={{ background: cv.tool === t ? "#f59e0b" : "#111827", color: cv.tool === t ? "#111" : "#e2e8f0", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>{l}</button>
          ))}
          {cv.tool !== "select" && cv.tool !== "eraser" && cv.tool !== "pan" && (
            <div style={{ display: "flex", gap: "4px" }}>
              {PAL.map(cl => (
                <button key={cl} onClick={() => { cv.setColor(cl); cv.setTool("pen"); }} style={{ width: "22px", height: "22px", background: cl, border: cv.color === cl && cv.tool === "pen" ? "3px solid white" : "2px solid #334155", borderRadius: "50%", cursor: "pointer" }} />
              ))}
            </div>
          )}
          {cv.tool !== "select" && cv.tool !== "pan" && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>Tam:</span>
              <input type="range" min="2" max="30" value={cv.brush} onChange={e => cv.setBrush(+e.target.value)} style={{ width: "56px" }} />
              <span style={{ fontSize: "12px", color: "#64748b" }}>{cv.brush}</span>
            </div>
          )}
          {cv.tool === "select" && cv.images.length === 0 && <span style={{ fontSize: "12px", color: "#475569", fontStyle: "italic" }}>Adicione uma imagem para selecionar</span>}
          {cv.tool === "select" && cv.selImg.length > 0 && <span style={{ fontSize: "12px", color: "#60a5fa" }}>✓ Seleção ativa — arraste os tokens na lona</span>}

          {cv.selImg.length > 0 && (
            <div style={{ display: "flex", gap: "8px", borderLeft: "2px solid #334155", paddingLeft: "8px", marginLeft: "4px" }}>
              <button onClick={() => cv.setImages(prev => prev.map(i => cv.selImg.includes(i.id) ? { ...i, layer: "token" } : i))} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>⬆️ Frente</button>
              <button onClick={() => cv.setImages(prev => prev.map(i => cv.selImg.includes(i.id) ? { ...i, layer: "map" } : i))} style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>⬇️ Fundo</button>
              <button onClick={() => { cv.setImages(prev => prev.filter(i => !cv.selImg.includes(i.id))); cv.setSelImg([]); }} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px" }}>🗑️ Excluir</button>
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "5px" }}>
            <button onClick={() => cv.fileRef.current?.click()} style={{ background: "#111827", color: "#e2e8f0", border: "1px solid #374151", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>🖼️ Imagem</button>
            <button onClick={cv.clearCv} style={{ background: "#111827", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>🗑️ Limpar</button>
          </div>
          <input ref={cv.fileRef as any} type="file" accept="image/*" style={{ display: "none" }} onChange={cv.loadImg} />
        </div>
      )}
      {!isMestre && (
        <div style={{ background: "#1e293b", padding: "8px 12px", display: "flex", gap: "10px", alignItems: "center", borderBottom: "1px solid #334155" }}>
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>🖐️ Arraste com o clique e use o Scroll do mouse para dar Zoom na mesa</span>
          <div style={{ marginLeft: "auto", width: "8px", height: "8px", background: "#22c55e", borderRadius: "50%" }} />
        </div>
      )}
      
      <div ref={cv.contRef} style={{ flex: 1, overflow: "hidden", background: "#0b0f19", position: "relative", touchAction: "none" }} onMouseDown={cv.onDown} onMouseMove={cv.onMove} onMouseUp={cv.onUp} onMouseLeave={cv.onUp} onTouchStart={cv.onDown} onTouchMove={cv.onMove} onTouchEnd={cv.onUp}>
        <canvas ref={cv.canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: cv.tool === "pan" ? "grab" : (cv.tool === "select" ? "default" : "crosshair") }} />
      </div>
    </div>
  );

  if (showCE) return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "20px" }}>
      <button onClick={() => { setShowCE(false); setEditChar(null); }} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", marginBottom: "16px", fontSize: "14px" }}>← Voltar</button>
      <CharEditor char={editChar} owner={user.username} onSave={saveChar} onCancel={() => { setShowCE(false); setEditChar(null); }} />
    </div>
  );

  const isAnotherMasterActive = members.some(m => m.role === "mestre" && m.username !== user.username);

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#1e293b", borderBottom: "2px solid #f59e0b", padding: "8px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px" }}>🎲</span>
        <span style={{ color: "#f59e0b", fontSize: "16px", fontWeight: "bold", fontFamily: "Georgia", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>{lobby.name}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          {isMestre ? <span style={{ background: "#422006", border: "1px solid #f59e0b", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#f59e0b", fontWeight: "bold" }}>👑 Mestre</span>
            : isEsp ? <span style={{ background: "#0f172a", border: "1px solid #64748b", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#94a3b8" }}>👁️ Espectador</span>
              : <span style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#60a5fa" }}>⚔️ {activeChar?.name || user.username}</span>}
          <button onClick={onLeave} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "12px" }}>Sair</button>
        </div>
      </div>

      <div style={{ display: "flex", background: "#1e293b", borderBottom: "1px solid #0f172a" }}>
        {TABS.map(([id, ico]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "9px 2px", background: "none", border: "none", borderBottom: tab === id ? "3px solid #f59e0b" : "3px solid transparent", color: tab === id ? "#f59e0b" : "#64748b", cursor: "pointer", fontSize: "11px", transition: "all .2s" }}>
            <div style={{ fontSize: "16px" }}>{ico}</div>
            <div style={{ fontWeight: tab === id ? "bold" : "normal" }}>{TLABELS[id]}</div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: (tab === "mestre" || tab === "tela") ? "hidden" : "auto", padding: (tab === "mestre" || tab === "tela") ? "0" : "14px", display: (tab === "mestre" || tab === "tela") ? "flex" : "block", flexDirection: "column" }}>
        {tab === "dados" && (
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
                  {ATTRS.map(a => <span key={a.key} style={{ background: "#0f172a", borderRadius: "4px", padding: "2px 5px", fontSize: "10px", color: bc((activeChar.bonuses as any)[a.key] || 0) }}>{a.short}: {((activeChar.bonuses as any)[a.key] || 0) >= 0 ? "+" : " "}{(activeChar.bonuses as any)[a.key] || 0}</span>)}
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
                  {ATTRS.map(a => { const bv = (activeChar.bonuses as any)[a.key] || 0; return (
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
            {activeChar && activeChar.skills?.length > 0 && (
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
        )}

        {tab === "personagens" && (
          <div style={{ maxWidth: "560px", margin: "0 auto" }}>
            <h2 style={{ color: "#f59e0b", fontFamily: "Georgia", margin: "0 0 14px" }}>Personagens</h2>
            {chars.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "#374151" }}><div style={{ fontSize: "40px" }}>⚔️</div><div>Nenhum personagem.</div></div>}
            {chars.map(c => (
              <div key={c.id} style={{ background: "#1e293b", border: `2px solid ${member.charId === c.id ? "#3b82f6" : "#334155"}`, borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
                {delC === c.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: "#f87171", flex: 1 }}>Deletar <strong>{c.name}</strong>?</span>
                    <button onClick={() => { onDeleteChar(c.id); setDelC(null); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}>Sim</button>
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
                        <div><div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>❤️ {c.hp}/{c.hpMax}</div><div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}><div style={{ background: c.hp / c.hpMax > .5 ? "#22c55e" : c.hp / c.hpMax > .25 ? "#eab308" : "#ef4444", width: `${Math.min(100, (c.hp / c.hpMax) * 100)}%`, height: "100%", borderRadius: "4px" }} /></div></div>
                        {c.vigorMax > 0 && <div><div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>⚡ {c.vigor}/{c.vigorMax}</div><div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}><div style={{ background: "#3b82f6", width: `${Math.min(100, (c.vigor / c.vigorMax) * 100)}%`, height: "100%", borderRadius: "4px" }} /></div></div>}
                      </div>
                      <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                        {ATTRS.map(a => <span key={a.key} style={{ background: "#0f172a", borderRadius: "4px", padding: "2px 5px", fontSize: "10px", color: bc((c.bonuses as any)[a.key] || 0) }}>{a.short}: {((c.bonuses as any)[a.key] || 0) >= 0 ? "+" : " "}{(c.bonuses as any)[a.key] || 0}</span>)}
                      </div>
                    </div>
                    {!isMestre && c.owner === user.username && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: "70px" }}>
                        <button onClick={() => { setEditChar(c); setShowCE(true); }} style={{ background: "#111827", color: "#94a3b8", border: "1px solid #374151", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }}>✏️</button>
                        <button onClick={() => setDelC(c.id)} style={{ background: "#111827", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "6px", padding: "5px 8px", cursor: "pointer", fontSize: "12px" }}>🗑️</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(tab === "mestre" || tab === "tela") && canvasPanelJSX}

        {tab === "sessao" && (
          <div style={{ maxWidth: "460px", margin: "0 auto" }}>
            <h2 style={{ color: "#f59e0b", fontFamily: "Georgia", margin: "0 0 14px" }}>👥 {lobby.name}</h2>
            
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "14px", marginBottom: "14px", display: "grid", gap: "10px", border: "1px solid #334155" }}>
              <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>⚡ TRANSMUTAR SEU PAPEL ATUAL</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                <button onClick={() => handleSwitchRoleInsideGame("mestre", null)} disabled={isAnotherMasterActive} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "mestre" ? "#f59e0b" : "#111827", color: member.role === "mestre" ? "#111" : isAnotherMasterActive ? "#374151" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: isAnotherMasterActive ? "not-allowed" : "pointer", opacity: isAnotherMasterActive ? 0.4 : 1 }} title={isAnotherMasterActive ? "Bloqueado: Já existe um Mestre comandando a mesa" : "Assumir a coroa do Mestre"}>👑 Mestre</button>
                <button onClick={() => handleSwitchRoleInsideGame("espectador", null)} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "espectador" ? "#a855f7" : "#111827", color: member.role === "espectador" ? "#fff" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>👁️ Assistir</button>
                <button onClick={() => {
                  if (chars.length > 0) handleSwitchRoleInsideGame("jogador", member.charId || chars[0].id);
                  else alert("Forje um herói na Armaria do menu inicial primeiro!");
                }} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "jogador" ? "#3b82f6" : "#111827", color: member.role === "jogador" ? "#fff" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>⚔️ Jogador</button>
              </div>

              {isAnotherMasterActive && (
                <div style={{ color: "#f87171", fontSize: "11px", fontStyle: "italic", textAlign: "center" }}>
                  ⚠️ O Trono do Mestre já está ocupado por outro narrador ativo.
                </div>
              )}

              {member.role === "jogador" && chars.length > 1 && (
                <div style={{ display: "grid", gap: "4px", marginTop: "4px", borderTop: "1px solid #334155", paddingTop: "8px" }}>
                  <label style={{ color: "#9ca3af", fontSize: "10px", fontWeight: "bold" }}>MUDAR DE HERÓI ATIVO NESTA MESA:</label>
                  <select style={{ ...I, padding: "6px", fontSize: "12px" }} value={member.charId || ""} onChange={(e) => handleSwitchRoleInsideGame("jogador", e.target.value)}>
                    {chars.map(c => (
                      <option key={c.id} value={c.id} style={{ background: "#111827" }}>{c.name} (Nv. {c.nivel} - {c.classe})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "14px", marginBottom: "14px" }}>
              <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "10px" }}>PARTICIPANTES ONLINE ({members.length})</div>
              {members.length === 0 && <div style={{ color: "#374151", fontSize: "13px", textAlign: "center", padding: "16px" }}>Ninguém mais na sessão.</div>}
              {members.map(m => (
                <div key={m.username} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", background: "#0f172a", borderRadius: "8px", marginBottom: "6px" }}>
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
        )}
      </div>
    </div>
  );
}