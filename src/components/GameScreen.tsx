// src/components/GameScreen.tsx
import { useState, useEffect } from "react";
import type { User, Lobby, Character, Member } from "../types";
import { useCanvas } from "../hooks/useCanvas";
import { supabase } from "../lib/supabase"; 
import CharEditor from "./CharEditor";
import DiceRoller from "./DiceRoller";
import CharacterList from "./CharacterList"; 
import { PAL, I } from "../utils/constants";

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

  const [tab, setTab] = useState(TABS[0][0]); 
  const [members, setMembers] = useState<Member[]>([]);
  const [editChar, setEditChar] = useState<Character | null>(null); 
  const [showCE, setShowCE] = useState(false);

  const cv = useCanvas(lobby.id, isMestre, tab);

  useEffect(() => {
    const pingOnline = async () => {
      try {
        await supabase.from("members").upsert({ lobby_id: lobby.id, username: user.username, role: member.role, char_id: member.charId || null, ts: Date.now() });
      } catch {}
    };
    pingOnline(); const iv = setInterval(pingOnline, 20000); return () => clearInterval(iv);
  }, [lobby.id, member, user.username]);

  const fetchActiveMembers = async () => {
    try {
      const { data } = await supabase.from("members").select("*").eq("lobby_id", lobby.id);
      if (data) {
        const active = data.filter((m: any) => Date.now() - m.ts < 40000).map((m: any) => ({ lobbyId: m.lobby_id, username: m.username, role: m.role, charId: m.char_id, ts: m.ts }));
        setMembers(active);
      }
    } catch {}
  };

  useEffect(() => {
    fetchActiveMembers();
    const canalPresenca = supabase.channel(`lobby_members:${lobby.id}`).on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `lobby_id=eq.${lobby.id}` }, () => { fetchActiveMembers(); }).subscribe();
    return () => { supabase.removeChannel(canalPresenca); };
  }, [lobby.id]);

  const handleSwitchRoleInsideGame = async (newRole: "mestre" | "jogador" | "espectador", chosenCharId: string | null) => {
    try {
      const timestamp = Date.now();
      const updatedMemberData = { lobby_id: lobby.id, username: user.username, role: newRole, char_id: newRole === "jogador" ? chosenCharId : null, ts: timestamp };
      const { error } = await supabase.from("members").upsert(updatedMemberData);
      if (error) throw error;

      const localMemberObj: Member = { lobbyId: lobby.id, username: user.username, role: newRole, charId: newRole === "jogador" ? chosenCharId : null, ts: timestamp };
      await window.storage.set("rpg_cur", JSON.stringify(localMemberObj));
      onUpdateMember(localMemberObj);

      const allowed = newRole === "mestre" ? ["dados", "mestre", "sessao"] : newRole === "espectador" ? ["tela", "sessao"] : ["dados", "personagens", "tela", "sessao"];
      if (!allowed.includes(tab)) setTab(allowed[0]);
    } catch { alert("⚠️ Erro ao transmutar papel no servidor."); }
  };

  const saveChar = async (c: Character) => { await onSaveChar(c); setShowCE(false); setEditChar(null); };

  const canvasPanelJSX = (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 110px)" }}>
      {isMestre && (
        <div style={{ background: "#1e293b", padding: "8px 10px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid #334155" }}>
          {[["pan", "🖐️ Arrastar"], ["select", "🖱️ Selecionar"], ["pen", "✏️ Caneta"], ["eraser", "⬜ Borracha"]].map(([t, l]) => (
            <button key={t} onClick={() => { cv.setTool(t); if (t !== "select") cv.setSelImg([]); }} style={{ background: cv.tool === t ? "#f59e0b" : "#111827", color: cv.tool === t ? "#111" : "#e2e8f0", border: "none", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>{l}</button>
          ))}
          {cv.tool !== "select" && cv.tool !== "eraser" && cv.tool !== "pan" && (
            <div style={{ display: "flex", gap: "4px" }}>{PAL.map(cl => (<button key={cl} onClick={() => { cv.setColor(cl); cv.setTool("pen"); }} style={{ width: "22px", height: "22px", background: cl, border: cv.color === cl && cv.tool === "pen" ? "3px solid white" : "2px solid #334155", borderRadius: "50%", cursor: "pointer" }} />))}</div>
          )}
          {cv.tool !== "select" && cv.tool !== "pan" && (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ fontSize: "12px", color: "#64748b" }}>Tam:</span><input type="range" min="2" max="30" value={cv.brush} onChange={e => cv.setBrush(+e.target.value)} style={{ width: "56px" }}/><span style={{ fontSize: "12px", color: "#64748b" }}>{cv.brush}</span></div>
          )}
          {cv.tool === "select" && cv.images.length === 0 && <span style={{ fontSize: "12px", color: "#475569", fontStyle: "italic" }}>Adicione uma imagem para selecionar</span>}
          {cv.tool === "select" && cv.selImg.length > 0 && <span style={{ fontSize: "12px", color: "#60a5fa" }}>✓ Seleção ativa — arraste os tokens</span>}
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
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>🖐️ Arraste com o clique e use o Scroll/Pinça do mouse para dar Zoom na mesa</span>
          <div style={{ marginLeft: "auto", width: "8px", height: "8px", background: "#22c55e", borderRadius: "50%" }} />
        </div>
      )}
      <div ref={cv.contRef} style={{ flex: 1, overflow: "hidden", background: "#0b0f19", position: "relative", touchAction: "none", cursor: cv.tool === "pan" ? "grab" : (cv.tool === "select" ? "default" : "crosshair") }} onMouseDown={cv.onDown} onMouseMove={cv.onMove} onMouseUp={cv.onUp} onMouseLeave={cv.onUp} onTouchStart={cv.onDown} onTouchMove={cv.onMove} onTouchEnd={cv.onUp}>
        <canvas ref={cv.bgRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        <canvas ref={cv.drawRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
        <canvas ref={cv.fgRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
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
          {isMestre ? <span style={{ background: "#422006", border: "1px solid #f59e0b", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#f59e0b", fontWeight: "bold" }}>👑 Mestre</span> : isEsp ? <span style={{ background: "#0f172a", border: "1px solid #64748b", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#94a3b8" }}>👁️ Espectador</span> : <span style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#60a5fa" }}>⚔️ {activeChar?.name || user.username}</span>}
          <button onClick={onLeave} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "12px" }}>Sair</button>
        </div>
      </div>

      <div style={{ display: "flex", background: "#1e293b", borderBottom: "1px solid #0f172a" }}>
        {TABS.map(([id, ico]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "9px 2px", background: "none", border: "none", borderBottom: tab === id ? "3px solid #f59e0b" : "3px solid transparent", color: tab === id ? "#f59e0b" : "#64748b", cursor: "pointer", fontSize: "11px", transition: "all .2s" }}><div style={{ fontSize: "16px" }}>{ico}</div><div style={{ fontWeight: tab === id ? "bold" : "normal" }}>{TLABELS[id]}</div></button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: (tab === "mestre" || tab === "tela") ? "hidden" : "auto", padding: (tab === "mestre" || tab === "tela") ? "0" : "14px", display: (tab === "mestre" || tab === "tela") ? "flex" : "block", flexDirection: "column" }}>
        
        {tab === "dados" && <DiceRoller activeChar={activeChar} />}

        {tab === "personagens" && (
          <CharacterList chars={chars} member={member} user={user} isMestre={isMestre} onDeleteChar={onDeleteChar} onEditChar={(c) => { setEditChar(c); setShowCE(true); }} />
        )}

        {(tab === "mestre" || tab === "tela") && canvasPanelJSX}

        {tab === "sessao" && (
          <div style={{ maxWidth: "460px", margin: "0 auto" }}>
            <h2 style={{ color: "#f59e0b", fontFamily: "Georgia", margin: "0 0 14px" }}>👥 {lobby.name}</h2>
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "14px", marginBottom: "14px", display: "grid", gap: "10px", border: "1px solid #334155" }}>
              <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold" }}>⚡ TRANSMUTAR SEU PAPEL ATUAL</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                <button onClick={() => handleSwitchRoleInsideGame("mestre", null)} disabled={isAnotherMasterActive} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "mestre" ? "#f59e0b" : "#111827", color: member.role === "mestre" ? "#111" : isAnotherMasterActive ? "#374151" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: isAnotherMasterActive ? "not-allowed" : "pointer", opacity: isAnotherMasterActive ? 0.4 : 1 }}>👑 Mestre</button>
                <button onClick={() => handleSwitchRoleInsideGame("espectador", null)} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "espectador" ? "#a855f7" : "#111827", color: member.role === "espectador" ? "#fff" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>👁️ Assistir</button>
                <button onClick={() => { if (chars.length > 0) handleSwitchRoleInsideGame("jogador", member.charId || chars[0].id); else alert("Forje um herói na Armaria primeiro!"); }} style={{ padding: "8px 2px", borderRadius: "6px", border: "none", background: member.role === "jogador" ? "#3b82f6" : "#111827", color: member.role === "jogador" ? "#fff" : "#e2e8f0", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>⚔️ Jogador</button>
              </div>
              {isAnotherMasterActive && <div style={{ color: "#f87171", fontSize: "11px", fontStyle: "italic", textAlign: "center" }}>⚠️ O Trono do Mestre já está ocupado.</div>}
              {member.role === "jogador" && chars.length > 1 && (
                <div style={{ display: "grid", gap: "4px", marginTop: "4px", borderTop: "1px solid #334155", paddingTop: "8px" }}>
                  <label style={{ color: "#9ca3af", fontSize: "10px", fontWeight: "bold" }}>MUDAR DE HERÓI ATIVO NESTA MESA:</label>
                  <select style={{ ...I, padding: "6px", fontSize: "12px" }} value={member.charId || ""} onChange={(e) => handleSwitchRoleInsideGame("jogador", e.target.value)}>
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
                  <span style={{ fontSize: "18px" }}>{m.role === "mestre" ? "👑" : m.role === "espectador" ? "👁️" : "⚔️"}</span>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: "bold", fontSize: "14px" }}>{m.username}{m.username === user.username ? " (você)" : ""}</div><div style={{ fontSize: "11px", color: "#64748b", textTransform: "capitalize" }}>{m.role}</div></div>
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