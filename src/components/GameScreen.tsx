// src/components/GameScreen.tsx
import { useState, useEffect, useRef } from "react";
import type { User, Lobby, Character, Member } from "../types";
import { useCanvas } from "../hooks/useCanvas";
import { supabase } from "../lib/supabase";
import CharEditor from "./CharEditor";
import DiceRoller from "./DiceRoller";
import CharacterList from "./CharacterList";
import SessionPanel from "./SessionPanel";
import { PAL } from "../utils/constants";

/* ── Canvas Toolbar ───────────────────────── */
interface CanvasToolbarProps {
  cv: ReturnType<typeof useCanvas>;
  isMestre: boolean;
}

function CanvasToolbar({ cv, isMestre }: CanvasToolbarProps) {
  const [showColorPop, setShowColorPop] = useState(false);
  const colorPopRef = useRef<HTMLDivElement>(null);

  // Fecha popup ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colorPopRef.current && !colorPopRef.current.contains(e.target as Node)) {
        setShowColorPop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 🔮 CORREÇÃO 1: Array vazio se não for mestre, ocultando todos os botões!
  const tools = isMestre ? [
    { id: "pan", icon: "✋", label: "Arrastar" },
    { id: "select", icon: "🖱️", label: "Selecionar" },
    { id: "pen", icon: "✏️", label: "Caneta" },
    { id: "eraser", icon: "⬜", label: "Borracha" },
  ] : [];

  const showPalette = cv.tool === "pen";
  const showSize = cv.tool === "pen" || cv.tool === "eraser";
  const hasSelection = cv.selImg.length > 0;

  return (
    <>
      {/* ── DESKTOP toolbar (hidden on mobile) ── */}
      <div style={{
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        padding: "6px 10px",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexWrap: "wrap",
      }} className="canvas-toolbar-desktop">

        {/* Ferramentas do Mestre */}
        {isMestre && (
          <div style={{ display: "flex", gap: "4px" }}>
            {tools.map(t => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => { cv.setTool(t.id); if (t.id !== "select") cv.setSelImg([]); }}
                style={{
                  background: cv.tool === t.id ? "#f59e0b" : "transparent",
                  color: cv.tool === t.id ? "#111" : "#94a3b8",
                  border: `1px solid ${cv.tool === t.id ? "#f59e0b" : "#374151"}`,
                  borderRadius: "8px",
                  padding: "5px 9px",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: cv.tool === t.id ? "bold" : "normal",
                  transition: "all .15s",
                }}
              >
                {t.icon}
              </button>
            ))}
          </div>
        )}

        {isMestre && (showPalette || showSize) && (
          <div style={{ width: "1px", height: "24px", background: "#334155", margin: "0 2px" }} />
        )}

        {isMestre && showPalette && (
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {PAL.map(cl => (
              <button
                key={cl}
                onClick={() => cv.setColor(cl)}
                style={{
                  width: "22px", height: "22px",
                  background: cl,
                  border: cv.color === cl ? "2.5px solid #fff" : "2px solid #374151",
                  borderRadius: "50%",
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "transform .1s",
                }}
              />
            ))}
          </div>
        )}

        {isMestre && showSize && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {(showPalette) && <div style={{ width: "1px", height: "24px", background: "#334155" }} />}
            <span style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap" }}>Tam</span>
            <input
              type="range" min="2" max="30" value={cv.brush}
              onChange={e => cv.setBrush(+e.target.value)}
              style={{ width: "56px" }}
            />
            <span style={{ fontSize: "12px", color: "#64748b", minWidth: "18px" }}>{cv.brush}</span>
          </div>
        )}

        {!isMestre && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", background: "#22c55e", borderRadius: "50%" }} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Apenas visualização</span>
          </div>
        )}

        {isMestre && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "5px" }}>
            <button
              onClick={() => cv.fileRef.current?.click()}
              style={{
                background: "transparent", color: "#94a3b8",
                border: "1px solid #374151", borderRadius: "7px",
                padding: "5px 10px", cursor: "pointer", fontSize: "12px",
                display: "flex", alignItems: "center", gap: "5px",
              }}
            >
              🖼️ <span>Imagem</span>
            </button>
            <button
              onClick={cv.clearCv}
              style={{
                background: "transparent", color: "#ef4444",
                border: "1px solid #ef4444", borderRadius: "7px",
                padding: "5px 9px", cursor: "pointer", fontSize: "12px",
              }}
              title="Limpar canvas"
            >
              🗑️
            </button>
          </div>
        )}

        <input ref={cv.fileRef as any} type="file" accept="image/*" style={{ display: "none" }} onChange={cv.loadImg} />
      </div>

      {/* ── SELEÇÃO: painel flutuante (desktop) ── */}
      {isMestre && hasSelection && (
        <div style={{
          position: "absolute",
          top: "56px",
          right: "12px",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "10px",
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          zIndex: 20,
          minWidth: "136px",
        }} className="sel-popup-desktop">
          <span style={{ fontSize: "10px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px", padding: "0 4px" }}>
            {cv.selImg.length} selecionado{cv.selImg.length > 1 ? "s" : ""}
          </span>
          {/* 🔮 CORREÇÃO 3: Removido o segundo argumento da chamada do selBtnStyle */}
          <button
            onClick={() => cv.setImages(prev => prev.map(img => cv.selImg.includes(img.id) ? { ...img, layer: "token" } : img))}
            style={selBtnStyle("#60a5fa")}
          >
            ⬆️ Mover p/ frente
          </button>
          <button
            onClick={() => cv.setImages(prev => prev.map(img => cv.selImg.includes(img.id) ? { ...img, layer: "map" } : img))}
            style={selBtnStyle("#f59e0b")}
          >
            ⬇️ Mover p/ fundo
          </button>
          <button
            onClick={() => { cv.setImages(prev => prev.filter(img => !cv.selImg.includes(img.id))); cv.setSelImg([]); }}
            style={selBtnStyle("#ef4444")}
          >
            🗑️ Excluir
          </button>
        </div>
      )}

      {/* ── MOBILE: barra flutuante no fundo ── */}
      <div style={{
        position: "absolute",
        bottom: "14px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "16px",
        padding: "6px 8px",
        display: "flex",
        alignItems: "center",
        gap: "3px",
        zIndex: 20,
        boxShadow: "0 4px 24px rgba(0,0,0,.55)",
      }} className="canvas-toolbar-mobile">

        {!isMestre ? (
          <div style={{ padding: "4px 8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", background: "#22c55e", borderRadius: "50%" }} />
            <span style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>Apenas visualização</span>
          </div>
        ) : (
          <>
            {/* 🔮 CORREÇÃO 2: Removido o 'i' que não era lido */}
            {tools.map((t) => (
              <button
                key={t.id}
                title={t.label}
                onClick={() => { cv.setTool(t.id); if (t.id !== "select") cv.setSelImg([]); setShowColorPop(false); }}
                style={{
                  width: "42px", height: "42px",
                  borderRadius: "11px",
                  border: "none",
                  background: cv.tool === t.id ? "#f59e0b" : "transparent",
                  color: cv.tool === t.id ? "#111" : "#94a3b8",
                  cursor: "pointer",
                  fontSize: "18px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all .15s",
                  flexShrink: 0,
                }}
              >
                {t.icon}
              </button>
            ))}

            <div style={{ width: "1px", height: "28px", background: "#334155", margin: "0 2px" }} />

            <div ref={colorPopRef} style={{ position: "relative" }}>
              <button
                title="Cor e tamanho"
                onClick={() => setShowColorPop(v => !v)}
                style={{
                  width: "42px", height: "42px",
                  borderRadius: "11px",
                  border: "none",
                  background: showColorPop ? "#374151" : "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "18px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                🎨
              </button>

              {showColorPop && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: "12px",
                  padding: "10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  zIndex: 30,
                  boxShadow: "0 4px 20px rgba(0,0,0,.6)",
                  minWidth: "200px",
                }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                    {PAL.map(cl => (
                      <button
                        key={cl}
                        onClick={() => { cv.setColor(cl); cv.setTool("pen"); }}
                        style={{
                          width: "26px", height: "26px",
                          background: cl,
                          border: cv.color === cl ? "2.5px solid #fff" : "2px solid #374151",
                          borderRadius: "50%",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", borderTop: "1px solid #334155", paddingTop: "8px" }}>
                    <span style={{ fontSize: "10px", color: "#64748b", whiteSpace: "nowrap" }}>TAMANHO</span>
                    <input
                      type="range" min="2" max="30" value={cv.brush}
                      onChange={e => cv.setBrush(+e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: "12px", color: "#94a3b8", minWidth: "20px" }}>{cv.brush}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: "1px", height: "28px", background: "#334155", margin: "0 2px" }} />

            <button
              title="Adicionar imagem"
              onClick={() => cv.fileRef.current?.click()}
              style={mobileFloatBtn}
            >🖼️</button>

            <button
              title="Limpar canvas"
              onClick={cv.clearCv}
              style={{ ...mobileFloatBtn, color: "#ef4444" }}
            >🗑️</button>
          </>
        )}

        <input ref={cv.fileRef as any} type="file" accept="image/*" style={{ display: "none" }} onChange={cv.loadImg} />
      </div>

      {/* ── SELEÇÃO: popup mobile (acima da float bar) ── */}
      {isMestre && hasSelection && (
        <div style={{
          position: "absolute",
          bottom: "76px",
          left: "50%",
          transform: "translateX(-50%)",
          background: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "12px",
          padding: "8px",
          display: "flex",
          gap: "6px",
          zIndex: 25,
          boxShadow: "0 4px 20px rgba(0,0,0,.55)",
          whiteSpace: "nowrap",
        }} className="sel-popup-mobile">
          <button
            onClick={() => cv.setImages(prev => prev.map(img => cv.selImg.includes(img.id) ? { ...img, layer: "token" } : img))}
            style={mobileSelBtn("#60a5fa", "#1e3a5f")}
          >⬆️ Frente</button>
          <button
            onClick={() => cv.setImages(prev => prev.map(img => cv.selImg.includes(img.id) ? { ...img, layer: "map" } : img))}
            style={mobileSelBtn("#f59e0b", "#422006")}
          >⬇️ Fundo</button>
          <button
            onClick={() => { cv.setImages(prev => prev.filter(img => !cv.selImg.includes(img.id))); cv.setSelImg([]); }}
            style={mobileSelBtn("#ef4444", "#1c0a0a")}
          >🗑️</button>
        </div>
      )}
    </>
  );
}

const selBtnStyle = (color: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: "6px",
  padding: "6px 8px",
  borderRadius: "7px",
  border: "none",
  background: "transparent",
  color,
  cursor: "pointer",
  fontSize: "12px",
  width: "100%",
  textAlign: "left",
  transition: "background .15s",
  fontFamily: "inherit",
});

const mobileFloatBtn: React.CSSProperties = {
  width: "42px", height: "42px",
  borderRadius: "11px",
  border: "none",
  background: "transparent",
  color: "#94a3b8",
  cursor: "pointer",
  fontSize: "18px",
  display: "flex", alignItems: "center", justifyContent: "center",
  flexShrink: 0,
};

const mobileSelBtn = (color: string, bg: string): React.CSSProperties => ({
  padding: "7px 12px",
  borderRadius: "8px",
  border: `1px solid ${color}22`,
  background: bg,
  color,
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "bold",
  fontFamily: "inherit",
});

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

  const isCanvas = tab === "mestre" || tab === "tela";

  const canvasPanelJSX = (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 110px)", position: "relative" }}>
      {/* Toolbar desktop — só mostra acima de 640px via CSS */}
      <style>{`
        @media (max-width: 639px) {
          .canvas-toolbar-desktop { display: none !important; }
          .sel-popup-desktop { display: none !important; }
        }
        @media (min-width: 640px) {
          .canvas-toolbar-mobile { display: none !important; }
          .sel-popup-mobile { display: none !important; }
        }
        .canvas-toolbar-desktop button:hover { background: #374151 !important; color: #e2e8f0 !important; }
        .canvas-toolbar-desktop button.active-tool { background: #f59e0b !important; color: #111 !important; }
        .sel-popup-desktop button:hover { background: rgba(255,255,255,0.07) !important; }
      `}</style>

      <CanvasToolbar cv={cv} isMestre={isMestre} />

      <div
        ref={cv.contRef}
        style={{
          flex: 1,
          overflow: "hidden",
          background: "#0b0f19",
          position: "relative",
          touchAction: "none",
          cursor: cv.tool === "pan" ? "grab" : cv.tool === "select" ? "default" : "crosshair",
        }}
        onMouseDown={cv.onDown}
        onMouseMove={cv.onMove}
        onMouseUp={cv.onUp}
        onMouseLeave={cv.onUp}
        onTouchStart={cv.onDown}
        onTouchMove={cv.onMove}
        onTouchEnd={cv.onUp}
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

  const isAnotherMasterActive = members.some(m => m.role === "mestre" && m.username !== user.username);

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Header */}
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

      {/* Tabs */}
      <div style={{ display: "flex", background: "#1e293b", borderBottom: "1px solid #0f172a" }}>
        {TABS.map(([id, ico]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "9px 2px", background: "none", border: "none", borderBottom: tab === id ? "3px solid #f59e0b" : "3px solid transparent", color: tab === id ? "#f59e0b" : "#64748b", cursor: "pointer", fontSize: "11px", transition: "all .2s" }}>
            <div style={{ fontSize: "16px" }}>{ico}</div>
            <div style={{ fontWeight: tab === id ? "bold" : "normal" }}>{TLABELS[id]}</div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: isCanvas ? "hidden" : "auto",
        padding: isCanvas ? "0" : "14px",
        display: isCanvas ? "flex" : "block",
        flexDirection: "column",
      }}>
        {tab === "dados" && <DiceRoller activeChar={activeChar} />}

        {tab === "personagens" && (
          <CharacterList
            chars={chars} member={member} user={user} isMestre={isMestre}
            onDeleteChar={onDeleteChar}
            onEditChar={(c) => { setEditChar(c); setShowCE(true); }}
          />
        )}

        {isCanvas && canvasPanelJSX}

        {tab === "sessao" && (
          <SessionPanel
            lobby={lobby} member={member} user={user} chars={chars}
            members={members} isAnotherMasterActive={isAnotherMasterActive}
            onSwitchRole={handleSwitchRoleInsideGame}
            onLeave={onLeave}
          />
        )}
      </div>
    </div>
  );
}