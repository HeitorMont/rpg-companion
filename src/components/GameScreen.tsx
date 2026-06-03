// src/components/GameScreen.tsx
import { useState, useEffect, useRef, useCallback, memo } from "react";
import type { User, Lobby, Character, Member } from "../types";
import { useCanvas } from "../hooks/useCanvas";
import { supabase } from "../lib/supabase";
import CharEditor from "./CharEditor";
import DiceRoller from "./DiceRoller";
import CharacterList from "./CharacterList";
import SessionPanel from "./SessionPanel";
import GlobalRollLog from "./GlobalRollLog"; // 🔮 Importando o nosso painel fantasma de rolagens
import { PAL } from "../utils/constants";

/* ── Canvas Toolbar ──────────────────────────────────────────────────────────── */
interface CanvasToolbarProps {
  cv: ReturnType<typeof useCanvas>;
  isMestre: boolean;
}

const CanvasToolbar = memo(function CanvasToolbar({ cv, isMestre }: CanvasToolbarProps) {
  const [showSizePop, setShowSizePop] = useState(false);
  const sizePopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sizePopRef.current && !sizePopRef.current.contains(e.target as Node)) {
        setShowSizePop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tools = isMestre
    ? [{ id: "pan", icon: "✋", label: "Arrastar" }, { id: "select", icon: "🖱️", label: "Selecionar" }, { id: "pen", icon: "✏️", label: "Caneta" }, { id: "eraser", icon: "⬜", label: "Borracha" }]
    : [{ id: "pan", icon: "✋", label: "Arrastar Mapa" }, { id: "ping", icon: "📍", label: "Sinalizar (Ping)" }];

  const hasSelection = cv.selImg.length > 0;

  return (
    <>
      <div style={{ position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)", background: "#1e293b", border: "1px solid #334155", borderRadius: "16px", padding: "6px 8px", display: "flex", alignItems: "center", gap: "4px", zIndex: 20, boxShadow: "0 4px 24px rgba(0,0,0,.55)" }}>
        {tools.map(t => (
          <button key={t.id} title={t.label} onClick={() => { cv.setTool(t.id); if (t.id !== "select") cv.setSelImg([]); setShowSizePop(false); }} style={{ width: "40px", height: "40px", borderRadius: "11px", border: "none", background: cv.tool === t.id ? "#f59e0b" : "transparent", color: cv.tool === t.id ? "#111" : "#94a3b8", cursor: "pointer", fontSize: "17px", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s", flexShrink: 0 }}>{t.icon}</button>
        ))}
        <div style={{ width: "1px", height: "26px", background: "#334155", margin: "0 2px" }} />
        {isMestre && (
          <div title="Cor do Traço" onClick={() => setShowSizePop(false)} style={{ width: "40px", height: "40px", borderRadius: "11px", border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "17px", pointerEvents: "none" }}>🎨</span>
            <div style={{ width: "16px", height: "4px", background: cv.color, borderRadius: "2px", marginTop: "2px", pointerEvents: "none" }} />
            <input type="color" value={cv.color} onChange={e => { cv.setColor(e.target.value); cv.setTool("pen"); }} style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", cursor: "pointer", top: 0, left: 0 }} />
          </div>
        )}
        {isMestre && (cv.tool === "pen" || cv.tool === "eraser") && (
          <div ref={sizePopRef} style={{ position: "relative" }}>
            <button title="Tamanho do Traço" onClick={() => setShowSizePop(v => !v)} style={{ width: "40px", height: "40px", borderRadius: "11px", border: "none", background: showSizePop ? "#374151" : "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "17px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>📏</button>
            {showSizePop && (
              <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "10px", display: "flex", alignItems: "center", gap: "8px", zIndex: 30, boxShadow: "0 4px 20px rgba(0,0,0,.6)", minWidth: "150px" }}>
                <span style={{ fontSize: "10px", color: "#64748b", fontWeight: "bold", whiteSpace: "nowrap" }}>TAM</span>
                <input type="range" min="2" max="30" value={cv.brush} onChange={e => cv.setBrush(+e.target.value)} style={{ flex: 1, cursor: "pointer" }} />
                <span style={{ fontSize: "11px", color: "#94a3b8", minWidth: "18px", textAlign: "center" }}>{cv.brush}</span>
              </div>
            )}
          </div>
        )}
        {isMestre && (cv.tool === "pen" || cv.tool === "eraser") && <div style={{ width: "1px", height: "26px", background: "#334155", margin: "0 2px" }} />}
        {isMestre && (
          <>
            <button title="Alternar Grade Tática" onClick={() => cv.setShowGrid(!cv.showGrid)} style={{ width: "40px", height: "40px", borderRadius: "11px", border: "none", background: cv.showGrid ? "#3b82f6" : "transparent", color: cv.showGrid ? "#ffffff" : "#94a3b8", cursor: "pointer", fontSize: "17px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>▦</button>
            <button title="Inserir Imagem/Token" onClick={() => cv.fileRef.current?.click()} style={{ width: "40px", height: "40px", borderRadius: "11px", border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: "17px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🖼️</button>
            <button title="Limpar Canvas" onClick={cv.clearCv} style={{ width: "40px", height: "40px", borderRadius: "11px", border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: "17px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🗑️</button>
            <input ref={cv.fileRef as any} type="file" accept="image/*" style={{ display: "none" }} onChange={cv.loadImg} />
          </>
        )}
      </div>
      {isMestre && hasSelection && (
        <div style={{ position: "absolute", bottom: "74px", left: "50%", transform: "translateX(-50%)", background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "6px 10px", display: "flex", alignItems: "center", gap: "6px", zIndex: 25, boxShadow: "0 4px 20px rgba(0,0,0,.55)", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", paddingRight: "4px", borderRight: "1px solid #334155", marginRight: "4px" }}>{cv.selImg.length} SEL</span>
          <button onClick={() => cv.setImages(prev => prev.map(img => cv.selImg.includes(img.id) ? { ...img, layer: "token" } : img))} style={{ padding: "5px 10px", borderRadius: "8px", border: "1px solid #60a5fa22", background: "#1e3a5f", color: "#60a5fa", cursor: "pointer", fontSize: "12px", fontWeight: "bold", fontFamily: "inherit" }}>⬆️ Frente</button>
          <button onClick={() => cv.setImages(prev => prev.map(img => cv.selImg.includes(img.id) ? { ...img, layer: "map" } : img))} style={{ padding: "5px 10px", borderRadius: "8px", border: "1px solid #f59e0b22", background: "#422006", color: "#f59e0b", cursor: "pointer", fontSize: "12px", fontWeight: "bold", fontFamily: "inherit" }}>⬇️ Fundo</button>
          <button onClick={() => cv.deleteSelectedImages()} style={{ padding: "5px 10px", borderRadius: "8px", border: "1px solid #ef444422", background: "#1c0a0a", color: "#ef4444", cursor: "pointer", fontSize: "12px", fontWeight: "bold", fontFamily: "inherit" }}>🗑️ Excluir</button>
        </div>
      )}
    </>
  );
});

/* ── Zoom Controls ───────────────────────────────────────────────────────────── */
const ZoomControls = memo(function ZoomControls({ cv }: { cv: any }) {
  const zoom = cv.zoom || 1;
  const setZoom = cv.setZoom || (() => {});

  return (
    <div style={{ 
      position: "absolute", right: "20px", top: "50%", transform: "translateY(-50%)", 
      background: "rgba(30, 41, 59, 0.9)", border: "1px solid #334155", borderRadius: "12px", 
      padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", 
      gap: "12px", zIndex: 20, boxShadow: "0 4px 20px rgba(0,0,0,.55)", backdropFilter: "blur(4px)" 
    }}>
      <button 
        onClick={() => setZoom(Math.min(4, zoom + 0.1))} 
        title="Aproximar (+)" 
        style={{ background: "transparent", color: "#f59e0b", border: "none", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px" }}
      >
        ➕
      </button>
      <div style={{ height: "100px", display: "flex", alignItems: "center", justifyContent: "center", width: "24px" }}>
        <input 
          type="range" 
          min="0.1" max="4" step="0.05" 
          value={zoom} 
          onChange={e => setZoom(parseFloat(e.target.value))}
          style={{ 
            transform: "rotate(-90deg)", width: "100px", cursor: "pointer", accentColor: "#f59e0b" 
          }} 
        />
      </div>
      <button 
        onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} 
        title="Afastar (-)" 
        style={{ background: "transparent", color: "#f59e0b", border: "none", cursor: "pointer", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px" }}
      >
        ➖
      </button>
      <div style={{ width: "100%", height: "1px", background: "#334155", margin: "2px 0" }} />
      <button 
        onClick={() => setZoom(1)} 
        title="Restaurar Zoom (100%)" 
        style={{ background: "transparent", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: "bold", padding: 0 }}
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  );
});

/* ── GameScreen ──────────────────────────────────────────────────────────────── */
interface GameScreenProps {
  user: User; lobby: Lobby; member: Member; chars: Character[];
  onLeave: () => void; onSaveChar: (c: Character) => Promise<void> | void;
  onDeleteChar: (id: string) => Promise<void> | void; onUpdateMember: (m: Member) => void;
}

export default function GameScreen({ user, lobby, member, chars, onLeave, onSaveChar, onDeleteChar, onUpdateMember }: GameScreenProps) {
  const isMestre = member.role === "mestre";
  const isEsp = member.role === "espectador";
  const activeChar = member.charId ? chars.find(c => c.id === member.charId) : null;

  const TABS = isMestre
    ? [["dados", "🎲"], ["mestre", "🗺️"], ["sessao", "👥"]]
    : isEsp ? [["tela", "🗺️"], ["sessao", "👥"]] : [["dados", "🎲"], ["personagens", "⚔️"], ["tela", "🗺️"], ["sessao", "👥"]];
  const TLABELS: Record<string, string> = { dados: "Dados", personagens: "Chars", mestre: "Mestre", sessao: "Sessão", tela: "Tela" };

  const [tab, setTab] = useState(TABS[0][0]);
  const [members, setMembers] = useState<Member[]>([]);
  const [editChar, setEditChar] = useState<Character | null>(null);
  const [showCE, setShowCE] = useState(false);

  const cv = useCanvas(lobby.id, isMestre, tab);

  const cvColorRef = useRef(cv.color);
  useEffect(() => { cvColorRef.current = cv.color; }, [cv.color]);

  const corDefinida = useRef(false);

  useEffect(() => {
    const pingOnline = async () => {
      try {
        let corParaEnviar = cvColorRef.current; 
        if (!corDefinida.current && !isMestre) {
          const { data } = await supabase.from("members").select("color, ts, username").eq("lobby_id", lobby.id);
          if (data) {
            const ativos = data.filter((m: any) => m.username !== user.username && Date.now() - m.ts < 40000);
            const coresOcupadas = ativos.map((m: any) => m.color);
            const coresLivres = PAL.filter(c => !coresOcupadas.includes(c));
            corParaEnviar = coresLivres.length > 0
              ? coresLivres[Math.floor(Math.random() * coresLivres.length)]
              : PAL[Math.floor(Math.random() * PAL.length)];
          }
          cv.setColor(corParaEnviar);
          corDefinida.current = true;
        }
        await supabase.from("members").upsert({
          lobby_id: lobby.id, username: user.username, role: member.role,
          char_id: member.charId || null, ts: Date.now(),
          color: isMestre ? cvColorRef.current : corParaEnviar,
        });
      } catch {}
    };
    pingOnline();
    const iv = setInterval(pingOnline, 20000);
    return () => clearInterval(iv);
  }, [lobby.id, member, user.username, isMestre, cv.setColor]);

  const fetchActiveMembers = useCallback(async () => {
    try {
      const { data } = await supabase.from("members").select("*").eq("lobby_id", lobby.id);
      if (data) {
        const active = data
          .filter((m: any) => Date.now() - m.ts < 40000)
          .map((m: any) => ({
            lobbyId: m.lobby_id, username: m.username, role: m.role,
            charId: m.char_id, ts: m.ts, color: m.color || "#ef4444",
          }));
        setMembers(active);
      }
    } catch {}
  }, [lobby.id]);

  useEffect(() => {
    fetchActiveMembers();
    const canal = supabase.channel(`lobby_members:${lobby.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `lobby_id=eq.${lobby.id}` }, fetchActiveMembers)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [lobby.id, fetchActiveMembers]);

  const handleSwitchRoleInsideGame = useCallback(async (newRole: "mestre" | "jogador" | "espectador", chosenCharId: string | null) => {
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
  }, [lobby.id, user.username, onUpdateMember, tab]);

  const saveChar = useCallback(async (c: Character) => {
    await onSaveChar(c); setShowCE(false); setEditChar(null);
  }, [onSaveChar]);

  const handleEditChar = useCallback((c: Character) => { setEditChar(c); setShowCE(true); }, []);

  const isCanvas = tab === "mestre" || tab === "tela";
  const isAnotherMasterActive = members.some(m => m.role === "mestre" && m.username !== user.username);

  // 🔮 REVOLUÇÃO: GlobalRollLog removido deste bloco interno para não desinstalar com a aba
  const canvasPanelJSX = (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 110px)", position: "relative" }}>
      <CanvasToolbar cv={cv} isMestre={isMestre} />
      <ZoomControls cv={cv} />
      <div
        ref={cv.contRef}
        style={{ flex: 1, overflow: "hidden", background: "#0b0f19", position: "relative", touchAction: "none", cursor: cv.tool === "pan" ? "grab" : cv.tool === "select" ? "default" : "crosshair" }}
        onMouseDown={cv.onDown} onMouseMove={cv.onMove} onMouseUp={cv.onUp} onMouseLeave={cv.onUp}
        onTouchStart={cv.onDown} onTouchMove={cv.onMove} onTouchEnd={cv.onUp}
      >
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

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "#1e293b", borderBottom: "2px solid #f59e0b", padding: "8px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px" }}>🎲</span>
        <span style={{ color: "#f59e0b", fontSize: "16px", fontWeight: "bold", fontFamily: "Georgia", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "130px" }}>{lobby.name}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          {isMestre
            ? <span style={{ background: "#422006", border: "1px solid #f59e0b", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#f59e0b", fontWeight: "bold" }}>👑 Mestre</span>
            : isEsp
              ? <span style={{ background: "#0f172a", border: "1px solid #64748b", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#94a3b8" }}>👁️ Espectador</span>
              : <span style={{ background: "#0f172a", border: "1px solid #3b82f6", borderRadius: "20px", padding: "2px 8px", fontSize: "11px", color: "#60a5fa" }}>⚔️ {activeChar?.name || user.username}</span>
          }
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

      <div style={{ flex: 1, overflowY: isCanvas ? "hidden" : "auto", padding: isCanvas ? "0" : "14px", display: isCanvas ? "flex" : "block", flexDirection: "column" }}>
        {tab === "dados" && <DiceRoller activeChar={activeChar} lobbyId={lobby.id} isMestre={isMestre} username={user.username} />}
        {tab === "personagens" && (
          <CharacterList chars={chars} member={member} user={user} isMestre={isMestre} onDeleteChar={onDeleteChar} onEditChar={handleEditChar} />
        )}
        {isCanvas && canvasPanelJSX}
        {tab === "sessao" && (
          <SessionPanel lobby={lobby} member={member} user={user} chars={chars} members={members} isAnotherMasterActive={isAnotherMasterActive} onSwitchRole={handleSwitchRoleInsideGame} onLeave={onLeave} />
        )}
      </div>

      {/* 🔮 TRUQUE DE MESTRE: O LOG SE TORNA GLOBAL, IMORTAL E ESCUTA 100% DO TEMPO */}
      {/* Passamos o 'visible' para ocultar visualmente nas outras abas sem perder o estado */}
      <GlobalRollLog lobbyId={lobby.id} visible={isCanvas} />
    </div>
  );
}