// src/components/LobbyBrowser.tsx
import { useState, useEffect } from "react";
import type { User, Lobby, Character } from "../types";
import { supabase } from "../lib/supabase";
import { hashPw } from "./LoginScreen";
import CharEditor from "./CharEditor";
import { ATTRS } from "../utils/constants"; // 🔮 Importação dos atributos atualizados!

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

const bc = (v: number) => (v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#475569");

interface LobbyBrowserProps {
  user: User; chars: Character[]; onLogout: () => void;
  onEnterLobby: (l: Lobby) => void; onSaveChar: (c: Character) => Promise<void>; onDeleteChar: (id: string) => Promise<void>;
}

export default function LobbyBrowser({ user, chars, onLogout, onEnterLobby, onSaveChar, onDeleteChar }: LobbyBrowserProps) {
  const [subTab, setSubTab] = useState<"lobbies" | "chars">("lobbies");
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [newLobbyName, setNewLobbyName] = useState("");
  const [newLobbyPw, setNewLobbyPw] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [joinPw, setJoinPw] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [editChar, setEditChar] = useState<Character | null>(null);
  const [showCE, setShowCE] = useState(false);
  const [delC, setDelC] = useState<string | null>(null);
  const [delLobbyId, setDelLobbyId] = useState<string | null>(null);

  const fetchLobbies = async () => {
    try {
      const { data, error } = await supabase
        .from("lobbies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const mapped: Lobby[] = data.map((l: any) => ({
          id: l.id,
          name: l.name,
          pwHash: l.pw_hash,
          ownerId: l.owner_id,
          isPublic: l.is_public,
          createdAt: l.created_at
        }));
        setLobbies(mapped);
      }
    } catch {
      console.error("Erro ao buscar lobbies online.");
    }
  };

  useEffect(() => {
    fetchLobbies();
    const iv = setInterval(fetchLobbies, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleCreateLobby = async () => {
    setErr("");
    if (!newLobbyName.trim()) { setErr("Dê um nome à sua mesa de jogo."); return; }
    if (!isPublic && !newLobbyPw.trim()) { setErr("Salas privadas exigem uma senha."); return; }
    setLoading(true);

    const lobbyId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const pass = isPublic ? null : hashPw(newLobbyPw);

    try {
      const { error } = await supabase
        .from("lobbies")
        .insert([{
          id: lobbyId,
          name: newLobbyName.trim(),
          pw_hash: pass,
          owner_id: user.username,
          is_public: isPublic,
          created_at: Date.now()
        }]);

      if (error) throw error;

      setNewLobbyName(""); setNewLobbyPw(""); setIsPublic(true);
      await fetchLobbies();
    } catch {
      setErr("Erro ao conjurar o lobby no servidor.");
    }
    setLoading(false);
  };

  const handleDeleteLobby = async (id: string) => {
    setErr("");
    try {
      const { error } = await supabase
        .from("lobbies")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchLobbies();
    } catch {
      setErr("Erro ao tentar dissipar o lobby do servidor.");
    }
  };

  const handleJoinLobby = (lob: Lobby) => {
    setErr("");
    if (!lob.isPublic && lob.ownerId !== user.username) {
      const inputPw = joinPw[lob.id] || "";
      if (hashPw(inputPw) !== lob.pwHash) { setErr(`Senha incorreta para a sala: ${lob.name}`); return; }
    }
    onEnterLobby(lob);
  };

  if (showCE) return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "20px" }}>
      <button onClick={() => { setShowCE(false); setEditChar(null); }} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", marginBottom: "16px", fontSize: "14px" }}>← Voltar</button>
      <CharEditor char={editChar} owner={user.username} onSave={async c => { await onSaveChar(c); setShowCE(false); setEditChar(null); }} onCancel={() => { setShowCE(false); setEditChar(null); }} />
    </div>
  );

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ background: "#1e293b", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>LOGADO COMO</div>
          <div style={{ fontWeight: "bold", color: "#f59e0b", fontSize: "16px" }}>🧙‍♂️ {user.username}</div>
        </div>
        <button onClick={onLogout} style={{ background: "transparent", color: "#64748b", border: "1px solid #374151", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" }}>Sair da Taverna</button>
      </div>

      <div style={{ display: "flex", background: "#111827", borderBottom: "2px solid #1e293b" }}>
        <button onClick={() => setSubTab("lobbies")} style={{ flex: 1, padding: "14px", background: "none", border: "none", borderBottom: subTab === "lobbies" ? "3px solid #f59e0b" : "3px solid transparent", color: subTab === "lobbies" ? "#f59e0b" : "#64748b", cursor: "pointer", fontWeight: "bold" }}>🌐 Lobbies Ativos</button>
        <button onClick={() => setSubTab("chars")} style={{ flex: 1, padding: "14px", background: "none", border: "none", borderBottom: subTab === "chars" ? "3px solid #f59e0b" : "3px solid transparent", color: subTab === "chars" ? "#f59e0b" : "#64748b", cursor: "pointer", fontWeight: "bold" }}>⚔️ Meus Personagens ({chars.length})</button>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "20px" }}>
        {err && <div style={{ color: "#f87171", fontSize: "13px", padding: "10px", background: "#1c0a0a", borderRadius: "6px", marginBottom: "14px" }}>⚠️ {err}</div>}

        {subTab === "lobbies" && (
          <div style={{ display: "grid", gap: "20px" }}>
            <div style={{ background: "#1e293b", borderRadius: "12px", padding: "16px", display: "grid", gap: "12px" }}>
              <h3 style={{ color: "#f59e0b", margin: 0, fontFamily: "Georgia" }}>Conjurar Nova Mesa</h3>
              <input style={I} value={newLobbyName} onChange={e => setNewLobbyName(e.target.value)} placeholder="Nome do Lobby / Campanha" />
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={() => setIsPublic(true)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: isPublic ? "#f59e0b" : "#111827", color: isPublic ? "#111" : "#64748b", fontWeight: "bold", cursor: "pointer" }}>🔓 Pública</button>
                <button onClick={() => setIsPublic(false)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: !isPublic ? "#ef4444" : "#111827", color: !isPublic ? "#fff" : "#64748b", fontWeight: "bold", cursor: "pointer" }}>🔒 Privada</button>
              </div>
              {!isPublic && <input type="password" style={I} value={newLobbyPw} onChange={e => setNewLobbyPw(e.target.value)} placeholder="Defina a Senha de Entrada" />}
              <button onClick={handleCreateLobby} disabled={loading} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "10px", fontWeight: "bold", cursor: "pointer" }}>{loading ? "Criando Portal..." : "✨ Abrir Mesa de Jogo"}</button>
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <h3 style={{ margin: "10px 0 0", color: "#64748b", fontSize: "12px", fontWeight: "bold", letterSpacing: "1px" }}>MESAS ONLINE</h3>
              {lobbies.length === 0 && <div style={{ color: "#374151", textAlign: "center", padding: "30px" }}>Nenhum lobby ativo neste plano astral.</div>}
              {lobbies.map(l => {
                const isOwner = l.ownerId === user.username;
                return (
                  <div key={l.id} style={{ background: "#1e293b", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {delLobbyId === l.id ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                        <span style={{ color: "#f87171", flex: 1, fontSize: "14px" }}>Dissipar e excluir permanentemente a mesa <strong>{l.name}</strong>?</span>
                        <button onClick={async () => { await handleDeleteLobby(l.id); setDelLobbyId(null); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>Sim</button>
                        <button onClick={() => setDelLobbyId(null)} style={{ background: "#374151", color: "#e2e8f0", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" }}>Não</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: "bold", fontSize: "16px" }}>{l.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "10px", background: l.isPublic ? "#14532d" : "#7f1d1d", color: l.isPublic ? "#4ade80" : "#f87171", fontWeight: "bold" }}>{l.isPublic ? "🔓 PÚBLICA" : "🔒 PRIVADA"}</span>
                            {isOwner && (
                              <button onClick={() => setDelLobbyId(l.id)} style={{ background: "transparent", color: "#f87171", border: "none", cursor: "pointer", fontSize: "14px", padding: 0 }} title="Dissipar Mesa">🗑️</button>
                            )}
                          </div>
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>Criador: <span style={{ color: "#94a3b8" }}>{isOwner ? "Você (Mestre)" : l.ownerId}</span></div>
                        
                        {!l.isPublic && !isOwner && (
                          <input type="password" style={{ ...I, padding: "6px 10px" }} value={joinPw[l.id] || ""} onChange={e => setJoinPw({ ...joinPw, [l.id]: e.target.value })} placeholder="Senha de Acesso" />
                        )}
                        
                        <button onClick={() => handleJoinLobby(l)} style={{ width: "100%", background: "#111827", color: "#f59e0b", border: "1px solid #f59e0b", padding: "8px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", transition: "all .2s" }}>
                          {isOwner ? "Iniciar Sessão (Mestre) →" : "Entrar na Mesa →"}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {subTab === "chars" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: "#f59e0b", margin: 0, fontFamily: "Georgia" }}>Armaria de Heróis</h3>
              <button onClick={() => { setEditChar(null); setShowCE(true); }} style={{ background: "#22c55e", color: "#111", border: "none", borderRadius: "6px", padding: "8px 14px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>➕ Criar Personagem</button>
            </div>
            {chars.length === 0 && <div style={{ fontStyle: "italic", color: "#374151", textAlign: "center", padding: "40px" }}>Nenhum herói forjado ainda. Crie um acima!</div>}
            {chars.map(c => (
              <div key={c.id} style={{ background: "#1e293b", border: "2px solid #334155", borderRadius: "12px", padding: "14px", marginBottom: "10px", display: "flex", gap: "12px" }}>
                {delC === c.id ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                    <span style={{ color: "#f87171", flex: 1, fontSize: "14px" }}>Banir permanentemente <strong>{c.name}</strong>?</span>
                    <button onClick={async () => { await onDeleteChar(c.id); setDelC(null); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>Sim</button>
                    <button onClick={() => setDelC(null)} style={{ background: "#374151", color: "#e2e8f0", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" }}>Não</button>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                        <span style={{ fontWeight: "bold", fontSize: "15px" }}>{c.name}</span>
                        <span style={{ background: "#0f172a", borderRadius: "10px", padding: "1px 8px", fontSize: "11px", color: "#f59e0b" }}>Nv.{c.nivel}</span>
                        {c.classe && <span style={{ fontSize: "12px", color: "#94a3b8" }}>{c.classe}</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
                        <div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>❤️ {c.hp}/{c.hpMax}</div>
                          <div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}><div style={{ background: c.hp / c.hpMax > .5 ? "#22c55e" : c.hp / c.hpMax > .25 ? "#eab308" : "#ef4444", width: `${Math.min(100, (c.hp / c.hpMax) * 100)}%`, height: "100%", borderRadius: "4px" }} /></div>
                        </div>
                        {c.vigorMax > 0 && <div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>⚡ {c.vigor}/{c.vigorMax}</div>
                          <div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}><div style={{ background: "#3b82f6", width: `${Math.min(100, (c.vigor / c.vigorMax) * 100)}%`, height: "100%", borderRadius: "4px" }} /></div>
                        </div>}
                      </div>
                      <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                        {/* 🔮 O FEITIÇO FOI SINCRONIZADO AQUI! */}
                        {ATTRS.map(a => {
                          const bv = (c.bonuses as any)[a.key] || 0;
                          return (
                            <span key={a.key} style={{ background: "#0f172a", borderRadius: "4px", padding: "2px 5px", fontSize: "10px", color: bc(bv) }}>
                              {a.short}: {bv >= 0 ? "+" : ""}{bv}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: "40px", flexShrink: 0 }}>
                      <button onClick={() => { setEditChar(c); setShowCE(true); }} style={{ background: "#111827", color: "#94a3b8", border: "1px solid #374151", borderRadius: "6px", padding: "6px", cursor: "pointer", fontSize: "13px" }} title="Editar Ficha">✏️</button>
                      <button onClick={() => setDelC(c.id)} style={{ background: "#1c0a0a", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "6px", padding: "6px", cursor: "pointer", fontSize: "13px" }} title="Excluir Ficha">🗑️</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}