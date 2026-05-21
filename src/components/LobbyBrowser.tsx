// src/components/LobbyBrowser.tsx
import { useState, useEffect, useCallback } from "react";
import type { User, Character, Lobby } from "../types";
import CharEditor from "./CharEditor";
import { hashPw } from "./LoginScreen";

const ATTRS = [
  { key: "for", short: "FOR", label: "Força" }, { key: "des", short: "DES", label: "Destreza" },
  { key: "con", short: "CON", label: "Constituição" }, { key: "int", short: "INT", label: "Inteligência" },
  { key: "sab", short: "SAB", label: "Sabedoria" }, { key: "car", short: "CAR", label: "Carisma" },
  { key: "sob", short: "SOB", label: "Sobrevivência" }, { key: "sor", short: "SOR", label: "Sorte" },
  { key: "fe", short: "FÉ", label: "Fé" },
];

const bc = (v: number) => (v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#475569");
const mkId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

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
const SI = { ...I, padding: "6px 8px", fontSize: "13px" };

/* ── LobbyCard ───────────────────────────────────────── */
interface LobbyCardProps {
  lob: Lobby;
  isMine: boolean;
  pw: string;
  onPwChange: (id: string, v: string) => void;
  onJoin: (lob: Lobby) => void;
  onDel: (id: string) => void;
}

function LobbyCard({ lob, isMine, pw, onPwChange, onJoin, onDel }: LobbyCardProps) {
  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "10px", padding: "12px", marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "18px" }}>{lob.isPublic ? "🌐" : "🔒"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: "bold", fontSize: "15px" }}>{lob.name}</div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            por {lob.ownerId} · {lob.isPublic ? "Público" : "Privado"}{lob.pwHash ? " · 🔑 senha" : ""}
          </div>
        </div>
        {isMine && (
          <button onClick={() => onDel(lob.id)} style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", fontSize: "11px" }}>
            🗑️
          </button>
        )}
      </div>
      {lob.pwHash && (
        <input style={{ ...SI, marginBottom: "8px" }} type="password" placeholder="Senha do lobby" value={pw || ""} onChange={e => onPwChange(lob.id, e.target.value)} />
      )}
      <button onClick={() => onJoin(lob)} style={{ background: "#1e3a5f", color: "#60a5fa", border: "1px solid #1e40af", borderRadius: "6px", padding: "7px", cursor: "pointer", fontSize: "13px", fontWeight: "bold", width: "100%" }}>
        Entrar →
      </button>
    </div>
  );
}

/* ── LobbyBrowser Main Component ──────────────────────── */
interface LobbyBrowserProps {
  user: User;
  chars: Character[];
  onEnterLobby: (lob: Lobby) => void;
  onLogout: () => void;
  onSaveChar: (c: Character) => Promise<void> | void;
  onDeleteChar: (id: string) => Promise<void> | void;
}

export default function LobbyBrowser({ user, chars, onEnterLobby, onLogout, onSaveChar, onDeleteChar }: LobbyBrowserProps) {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [mine, setMine] = useState<Lobby[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [lName, setLName] = useState("");
  const [lPw, setLPw] = useState("");
  const [lPub, setLPub] = useState(true);
  const [joinPw, setJoinPw] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState("lobbies");
  const [showCE, setShowCE] = useState(false);
  const [editChar, setEditChar] = useState<Character | null>(null);
  const [delC, setDelC] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // @ts-ignore
      const r = await window.storage.list("rpg_lob:", true);
      if (r?.keys?.length) {
        // @ts-ignore
        const all = (await Promise.all(r.keys.map(async (k: string) => { try { const d = await window.storage.get(k, true); return d ? JSON.parse(d.value) : null; } catch { return null; } }))).filter(Boolean);
        setMine(all.filter((l: Lobby) => l.ownerId === user.username));
        setLobbies(all.filter((l: Lobby) => l.isPublic && l.ownerId !== user.username));
      } else {
        setMine([]);
        setLobbies([]);
      }
    } catch {}
  }, [user.username]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const create = async () => {
    if (!lName.trim()) { setErr("Dê um nome ao lobby."); return; }
    setLoading(true);
    const id = mkId();
    const lob: Lobby = { id, name: lName.trim(), pwHash: lPw ? hashPw(lPw) : null, ownerId: user.username, isPublic: lPub, createdAt: Date.now() };
    try {
      // @ts-ignore
      await window.storage.set(`rpg_lob:${id}`, JSON.stringify(lob), true);
      setShowCreate(false); setLName(""); setLPw(""); setErr("");
      await load();
      onEnterLobby(lob);
    } catch {
      setErr("Erro ao criar.");
    }
    setLoading(false);
  };

  const join = async (lob: Lobby) => {
    const pw = joinPw[lob.id] || "";
    if (lob.pwHash) {
      if (!pw) { setErr(`Senha necessária para "${lob.name}".`); return; }
      if (hashPw(pw) !== lob.pwHash) { setErr("Senha incorreta."); return; }
    }
    setErr("");
    onEnterLobby(lob);
  };

  const del = async (id: string) => {
    // @ts-ignore
    try { await window.storage.delete(`rpg_lob:${id}`, true); await load(); } catch {}
  };
  
  const onPwChange = (id: string, v: string) => setJoinPw(p => ({ ...p, [id]: v }));

  if (showCE) {
    return (
      <div style={{ background: "#0f172a", minHeight: "100vh", padding: "20px", fontFamily: "'Segoe UI',sans-serif" }}>
        <button onClick={() => { setShowCE(false); setEditChar(null); }} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", marginBottom: "16px", fontSize: "14px" }}>← Voltar</button>
        <CharEditor char={editChar} owner={user.username} onSave={async c => { await onSaveChar(c); setShowCE(false); setEditChar(null); }} onCancel={() => { setShowCE(false); setEditChar(null); }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif" }}>
      {/* Cabeçalho */}
      <div style={{ background: "#1e293b", borderBottom: "2px solid #f59e0b", padding: "10px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "20px" }}>🎲</span>
        <span style={{ color: "#f59e0b", fontSize: "17px", fontWeight: "bold", fontFamily: "Georgia" }}>RPG Companion</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px", color: "#94a3b8" }}>👤 {user.username}</span>
          <button onClick={onLogout} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", fontSize: "12px" }}>Sair</button>
        </div>
      </div>

      {/* Menu de Abas */}
      <div style={{ display: "flex", background: "#1e293b", borderBottom: "1px solid #0f172a" }}>
        <button onClick={() => setTab("lobbies")} style={{ flex: 1, padding: "12px", background: "none", border: "none", borderBottom: tab === "lobbies" ? "3px solid #f59e0b" : "3px solid transparent", color: tab === "lobbies" ? "#f59e0b" : "#64748b", cursor: "pointer", fontWeight: tab === "lobbies" ? "bold" : "normal", transition: "all .2s" }}>🌐 Lobbies</button>
        <button onClick={() => setTab("chars")} style={{ flex: 1, padding: "12px", background: "none", border: "none", borderBottom: tab === "chars" ? "3px solid #f59e0b" : "3px solid transparent", color: tab === "chars" ? "#f59e0b" : "#64748b", cursor: "pointer", fontWeight: tab === "chars" ? "bold" : "normal", transition: "all .2s" }}>⚔️ Meus Personagens</button>
      </div>

      <div style={{ padding: "16px", maxWidth: "560px", margin: "0 auto" }}>
        {tab === "lobbies" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ color: "#f59e0b", fontFamily: "Georgia", margin: 0 }}>Salas de Jogo</h2>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={load} style={{ background: "transparent", color: "#64748b", border: "1px solid #374151", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", fontSize: "12px" }}>↻</button>
                <button onClick={() => setShowCreate(s => !s)} style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "7px 14px", fontWeight:"bold", cursor: "pointer", fontSize: "13px" }}>+ Criar</button>
              </div>
            </div>

            {showCreate && (
              <div style={{ background: "#1e293b", borderRadius: "12px", padding: "16px", marginBottom: "16px", border: "1px solid #334155" }}>
                <h3 style={{ color: "#f59e0b", margin: "0 0 12px", fontSize: "15px" }}>Novo Lobby</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  <div><label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>NOME</label>
                    <input style={I} value={lName} onChange={e => setLName(e.target.value)} placeholder="Ex: Aventura nas Terras do Norte" /></div>
                  <div><label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold", display: "block", marginBottom: "4px" }}>SENHA (opcional)</label>
                    <input type="password" style={I} value={lPw} onChange={e => setLPw(e.target.value)} placeholder="Deixe vazio para sem senha" /></div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", color: "#94a3b8", fontSize: "13px" }}>
                    <input type="checkbox" checked={lPub} onChange={e => setLPub(e.target.checked)} />
                    Lobby público (aparece na lista)
                  </label>
                  {err && <div style={{ color: "#f87171", fontSize: "13px" }}>{err}</div>}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={create} disabled={loading} style={{ flex: 1, background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "10px", fontWeight: "bold", cursor: "pointer" }}>{loading ? "Criando..." : "Criar"}</button>
                    <button onClick={() => { setShowCreate(false); setErr(""); }} style={{ flex: 1, background: "#374151", color: "#e5e7eb", border: "none", borderRadius: "8px", padding: "10px", cursor: "pointer" }}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {err && !showCreate && <div style={{ color: "#f87171", fontSize: "13px", padding: "8px 10px", background: "#1c0a0a", borderRadius: "6px", marginBottom: "12px" }}>⚠️ {err}</div>}

            {mine.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "8px" }}>MEUS LOBBIES</div>
                {mine.map(l => <LobbyCard key={l.id} lob={l} isMine={true} pw={joinPw[l.id]} onPwChange={onPwChange} onJoin={join} onDel={del} />)}
              </div>
            )}

            <div>
              <div style={{ color: "#64748b", fontSize: "11px", fontWeight: "bold", marginBottom: "8px" }}>LOBBIES PÚBLICOS</div>
              {lobbies.length === 0
                ? <div style={{ textAlign: "center", padding: "40px", color: "#374151" }}><div style={{ fontSize: "32px", marginBottom: "8px" }}>🔍</div><div>Nenhum lobby público.</div><div style={{ fontSize: "12px", marginTop: "4px" }}>Crie um para começar!</div></div>
                : lobbies.map(l => <LobbyCard key={l.id} lob={l} isMine={false} pw={joinPw[l.id]} onPwChange={onPwChange} onJoin={join} onDel={del} />)}
            </div>
          </div>
        )}

        {tab === "chars" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ color: "#f59e0b", fontFamily: "Georgia", margin: 0 }}>Armaria</h2>
              <button onClick={() => { setEditChar(null); setShowCE(true); }} style={{ background: "#f59e0b", color: "#111", border: "none", borderRadius: "8px", padding: "7px 14px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>+ Novo Personagem</button>
            </div>

            {chars.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px", color: "#374151" }}>
                <div style={{ fontSize: "40px", marginBottom: "8px" }}>⚔️</div>
                <div>Nenhum aventureiro criado.</div>
                <div style={{ fontSize: "12px", marginTop: "4px" }}>Forje seu primeiro herói!</div>
              </div>
            )}

            {chars.map(c => (
              <div key={c.id} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "12px", padding: "14px", marginBottom: "10px" }}>
                {delC === c.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ color: "#f87171", flex: 1 }}>Deletar <strong>{c.name}</strong> permanentemente?</span>
                    <button onClick={() => { onDeleteChar(c.id); setDelC(null); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold" }}>Sim</button>
                    <button onClick={() => setDelC(null)} style={{ background: "#374151", color: "#e2e8f0", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer" }}>Não</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: "bold", fontSize: "16px" }}>{c.name}</span>
                        <span style={{ background: "#0f172a", borderRadius: "10px", padding: "1px 8px", fontSize: "11px", color: "#f59e0b", fontWeight: "bold" }}>Nv.{c.nivel}</span>
                        {c.classe && <span style={{ fontSize: "12px", color: "#94a3b8" }}>{c.classe}</span>}
                        {c.skills && c.skills.length > 0 && <span style={{ fontSize: "11px", color: "#a855f7", background: "#1e0a2e", borderRadius: "10px", padding: "1px 7px" }}>⚡ {c.skills.length}</span>}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
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

                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {ATTRS.map(a => <span key={a.key} style={{ background: "#0f172a", borderRadius: "4px", padding: "2px 5px", fontSize: "10px", border: "1px solid #1e2937", color: bc(c.bonuses[a.key] || 0) }}>{a.short}: {(c.bonuses[a.key] || 0) >= 0 ? "+" : " "}{c.bonuses[a.key] || 0}</span>)}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "45px" }}>
                      <button onClick={() => { setEditChar(c); setShowCE(true); }} style={{ background: "#111827", color: "#94a3b8", border: "1px solid #374151", borderRadius: "6px", padding: "6px", cursor: "pointer", fontSize: "14px", flex: 1 }} title="Editar">✏️</button>
                      <button onClick={() => setDelC(c.id)} style={{ background: "#111827", color: "#ef4444", border: "1px solid #7f1d1d", borderRadius: "6px", padding: "6px", cursor: "pointer", fontSize: "14px", flex: 1 }} title="Deletar">🗑️</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}