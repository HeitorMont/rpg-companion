// src/components/LobbyBrowser.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import type { User, Lobby, Character } from "../types";
import { supabase } from "../lib/supabase";
import { hashPw } from "./LoginScreen";
import CharEditor from "./CharEditor";
import { ATTRS, I, bc } from "../utils/constants";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface LobbyActivity {
  total: number;
  mestres: number;
  jogadores: number;
  espectadores: number;
  nomes: string[];
}

type FilterType = "todas" | "ativas" | "publicas" | "privadas";
type SortType   = "atividade" | "nome" | "recente";

// ── Helpers ───────────────────────────────────────────────────────────────────

const tempoRelativo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1)  return "agora mesmo";
  if (mins < 60) return `há ${mins}min`;
  if (hrs  < 24) return `há ${hrs}h`;
  return `há ${days}d`;
};

const VAZIO: LobbyActivity = { total: 0, mestres: 0, jogadores: 0, espectadores: 0, nomes: [] };
const ITEMS_PER_PAGE = 6;

// ── Card individual de Lobby ──────────────────────────────────────────────────

interface LobbyCardProps {
  l: Lobby;
  isOwner: boolean;
  activity: LobbyActivity;
  joinPw: string;
  onJoinPwChange: (v: string) => void;
  onJoin: () => void;
  onDelete: () => void;
}

function LobbyCard({ l, isOwner, activity, joinPw, onJoinPwChange, onJoin, onDelete }: LobbyCardProps) {
  const [delConfirm, setDelConfirm] = useState(false);
  const isActive  = activity.total > 0;
  const hasMestre = activity.mestres > 0;

  const borderColor = isOwner
    ? "rgba(245,158,11,0.35)"
    : isActive ? "rgba(34,197,94,0.25)" : "#334155";

  const topBarBg = isOwner
    ? "rgba(245,158,11,0.07)"
    : isActive ? "rgba(34,197,94,0.07)" : "rgba(15,23,42,0.4)";

  const topBarBorder = isOwner
    ? "rgba(245,158,11,0.12)"
    : isActive ? "rgba(34,197,94,0.12)" : "#0f172a";

  const statusColor = isActive ? "#22c55e" : "#475569";

  return (
    <div style={{ background: "#1e293b", border: `1.5px solid ${borderColor}`, borderRadius: "14px", overflow: "hidden", marginBottom: "10px" }}>

      {/* Barra de status */}
      <div style={{ background: topBarBg, borderBottom: `1px solid ${topBarBorder}`, padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: statusColor, boxShadow: isActive ? `0 0 7px ${statusColor}` : "none", flexShrink: 0 }} />
          <span style={{ fontSize: "10px", fontWeight: "bold", letterSpacing: "0.6px", color: statusColor }}>
            {isActive ? "EM SESSÃO" : "AGUARDANDO"}
          </span>
          {isActive && (
            <span style={{ fontSize: "10px", color: "#475569", marginLeft: "4px" }}>
              — {activity.nomes.slice(0, 2).join(", ")}
              {activity.nomes.length > 2 ? ` +${activity.nomes.length - 2}` : ""}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "10px", fontWeight: "bold", background: l.isPublic ? "#14532d" : "#450a0a", color: l.isPublic ? "#4ade80" : "#f87171" }}>
            {l.isPublic ? "🔓 PÚBLICA" : "🔒 PRIVADA"}
          </span>
          {isOwner && !delConfirm && (
            <button onClick={() => setDelConfirm(true)} style={{ background: "transparent", color: "#475569", border: "none", cursor: "pointer", fontSize: "13px", padding: 0, lineHeight: 1 }}>🗑️</button>
          )}
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: "12px 14px" }}>
        {delConfirm ? (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ color: "#f87171", flex: 1, fontSize: "13px" }}>Dissipar permanentemente <strong>{l.name}</strong>?</span>
            <button onClick={() => { onDelete(); setDelConfirm(false); }} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" }}>Sim</button>
            <button onClick={() => setDelConfirm(false)} style={{ background: "#374151", color: "#e2e8f0", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "12px" }}>Não</button>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: "bold", fontSize: "16px", color: "#f1f5f9", marginBottom: "2px" }}>{l.name}</div>
            <div style={{ fontSize: "11px", color: "#475569", marginBottom: "10px" }}>
              {isOwner ? "Sua mesa" : `por ${l.ownerId}`} · {tempoRelativo(l.createdAt)}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "12px", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "7px", fontSize: "11px", fontWeight: "bold", background: hasMestre ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)", color: hasMestre ? "#f59e0b" : "#475569", border: `1px solid ${hasMestre ? "rgba(245,158,11,0.25)" : "#334155"}` }}>👑 {activity.mestres}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "7px", fontSize: "11px", fontWeight: "bold", background: activity.jogadores > 0 ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)", color: activity.jogadores > 0 ? "#60a5fa" : "#475569", border: `1px solid ${activity.jogadores > 0 ? "rgba(59,130,246,0.25)" : "#334155"}` }}>⚔️ {activity.jogadores}</span>
              {activity.espectadores > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "7px", fontSize: "11px", fontWeight: "bold", background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.25)" }}>👁️ {activity.espectadores}</span>
              )}
              {isActive && <span style={{ marginLeft: "auto", fontSize: "11px", color: "#22c55e", fontWeight: "bold" }}>{activity.total} online</span>}
            </div>
            {!l.isPublic && !isOwner && (
              <input type="password" style={{ ...I, padding: "7px 10px", fontSize: "13px", marginBottom: "10px" }} value={joinPw} onChange={e => onJoinPwChange(e.target.value)} placeholder="Senha de acesso" />
            )}
            <button onClick={onJoin} style={{ width: "100%", background: isOwner ? "rgba(245,158,11,0.1)" : isActive ? "rgba(59,130,246,0.1)" : "#111827", color: isOwner ? "#f59e0b" : isActive ? "#60a5fa" : "#94a3b8", border: `1px solid ${isOwner ? "rgba(245,158,11,0.3)" : isActive ? "rgba(59,130,246,0.3)" : "#334155"}`, borderRadius: "8px", padding: "9px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>
              {isOwner ? "Iniciar Sessão (Mestre) →" : "Entrar na Mesa →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Paginação ─────────────────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  onPrev: () => void;
  onNext: () => void;
  onPage: (p: number) => void;
}

function Pagination({ currentPage, totalPages, totalItems, onPrev, onNext, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Gera a lista de páginas a exibir (máx 5 botões, com reticências)
  const pages: (number | "...")[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const btnBase: React.CSSProperties = { background: "transparent", border: "1px solid #334155", borderRadius: "7px", color: "#94a3b8", cursor: "pointer", fontSize: "12px", padding: "5px 9px", minWidth: "32px", textAlign: "center" as const };
  const btnActive: React.CSSProperties = { ...btnBase, background: "#f59e0b", border: "1px solid #f59e0b", color: "#111", fontWeight: "bold" };
  const btnDisabled: React.CSSProperties = { ...btnBase, opacity: 0.3, cursor: "not-allowed" };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
      <span style={{ fontSize: "11px", color: "#475569" }}>
        {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalItems)}–{Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} de {totalItems}
      </span>
      <div style={{ display: "flex", gap: "4px" }}>
        <button onClick={onPrev} disabled={currentPage === 1} style={currentPage === 1 ? btnDisabled : btnBase}>‹</button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dots-${i}`} style={{ padding: "5px 4px", fontSize: "12px", color: "#475569" }}>…</span>
          ) : (
            <button key={p} onClick={() => onPage(p as number)} style={p === currentPage ? btnActive : btnBase}>{p}</button>
          )
        )}
        <button onClick={onNext} disabled={currentPage === totalPages} style={currentPage === totalPages ? btnDisabled : btnBase}>›</button>
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────

interface LobbyBrowserProps {
  user: User; chars: Character[]; onLogout: () => void;
  onEnterLobby: (l: Lobby) => void; onSaveChar: (c: Character) => Promise<void>; onDeleteChar: (id: string) => Promise<void>;
}

export default function LobbyBrowser({ user, chars, onLogout, onEnterLobby, onSaveChar, onDeleteChar }: LobbyBrowserProps) {
  const [subTab, setSubTab] = useState<"lobbies" | "chars">("lobbies");
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [activityPerLobby, setActivityPerLobby] = useState<Record<string, LobbyActivity>>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Criação
  const [showCreation, setShowCreation] = useState(false);
  const [newLobbyName, setNewLobbyName] = useState("");
  const [newLobbyPw, setNewLobbyPw]     = useState("");
  const [isPublic, setIsPublic]           = useState(true);

  // ── Busca, filtros e ordenação ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType]   = useState<FilterType>("todas");
  const [sortBy, setSortBy]           = useState<SortType>("atividade");
  const [currentPage, setCurrentPage] = useState(1);

  const [joinPw, setJoinPw] = useState<Record<string, string>>({});
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  // Personagens
  const [editChar, setEditChar] = useState<Character | null>(null);
  const [showCE, setShowCE]     = useState(false);
  const [delC, setDelC]         = useState<string | null>(null);

  // ── Reset de página ao mudar busca/filtro/ordenação ──────────────────────

  useEffect(() => { setCurrentPage(1); }, [searchQuery, filterType, sortBy]);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchLobbies = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("lobbies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      if (!data) return;

      const mapped: Lobby[] = data.map((l: any) => ({
        id: l.id, name: l.name, pwHash: l.pw_hash,
        ownerId: l.owner_id, isPublic: l.is_public, createdAt: l.created_at,
      }));
      setLobbies(mapped);
      setLastRefresh(new Date());

      const ids = mapped.map(l => l.id);
      if (!ids.length) return;

      const cutoff = Date.now() - 40_000;
      const { data: memberData } = await supabase
        .from("members").select("lobby_id, username, role, ts")
        .in("lobby_id", ids).gt("ts", cutoff);

      if (memberData) {
        const grouped: Record<string, LobbyActivity> = {};
        memberData.forEach((m: any) => {
          if (!grouped[m.lobby_id]) grouped[m.lobby_id] = { total: 0, mestres: 0, jogadores: 0, espectadores: 0, nomes: [] };
          const g = grouped[m.lobby_id];
          g.total++;
          if (m.role === "mestre")          g.mestres++;
          else if (m.role === "jogador")     g.jogadores++;
          else if (m.role === "espectador")  g.espectadores++;
          g.nomes.push(m.username);
        });
        setActivityPerLobby(grouped);
      }
    } catch { console.error("Erro ao buscar lobbies."); }
  }, []);

  useEffect(() => {
    fetchLobbies();
    const iv = setInterval(fetchLobbies, 15_000);
    return () => clearInterval(iv);
  }, [fetchLobbies]);

  // ── Lógica de filtro + ordenação (client-side, sem chamada extra ao banco) ─

  const myLobbies = useMemo(
    () => lobbies.filter(l => l.ownerId === user.username),
    [lobbies, user.username]
  );

  // Aplica busca → filtro → ordenação sobre os lobbies de terceiros
  const filteredOtherLobbies = useMemo(() => {
    let result = lobbies.filter(l => l.ownerId !== user.username);

    // Busca: nome ou dono
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.ownerId.toLowerCase().includes(q)
      );
    }

    // Filtro de tipo
    if (filterType === "ativas")   result = result.filter(l => (activityPerLobby[l.id]?.total ?? 0) > 0);
    if (filterType === "publicas") result = result.filter(l => l.isPublic);
    if (filterType === "privadas") result = result.filter(l => !l.isPublic);

    // Ordenação
    if (sortBy === "atividade") result = [...result].sort((a, b) => (activityPerLobby[b.id]?.total ?? 0) - (activityPerLobby[a.id]?.total ?? 0));
    if (sortBy === "nome")      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if (sortBy === "recente")   result = [...result].sort((a, b) => b.createdAt - a.createdAt);

    return result;
  }, [lobbies, user.username, searchQuery, filterType, sortBy, activityPerLobby]);

  const totalPages        = Math.ceil(filteredOtherLobbies.length / ITEMS_PER_PAGE);
  const paginatedLobbies  = filteredOtherLobbies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const totalAtivos = Object.values(activityPerLobby).reduce((acc, a) => acc + a.total, 0);

  // ── Criar lobby ───────────────────────────────────────────────────────────

  const handleCreateLobby = async () => {
    setErr("");
    if (!newLobbyName.trim()) { setErr("Dê um nome à sua mesa de jogo."); return; }
    if (!isPublic && !newLobbyPw.trim()) { setErr("Salas privadas exigem uma senha."); return; }
    setLoading(true);
    const lobbyId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try {
      const { error } = await supabase.from("lobbies").insert([{ id: lobbyId, name: newLobbyName.trim(), pw_hash: isPublic ? null : hashPw(newLobbyPw), owner_id: user.username, is_public: isPublic, created_at: Date.now() }]);
      if (error) throw error;
      setNewLobbyName(""); setNewLobbyPw(""); setIsPublic(true); setShowCreation(false);
      await fetchLobbies();
    } catch { setErr("Erro ao conjurar o lobby no servidor."); }
    setLoading(false);
  };

  // ── Deletar lobby ─────────────────────────────────────────────────────────

  const handleDeleteLobby = async (id: string) => {
    setErr("");
    try {
      const { data: files } = await supabase.storage.from("canvas_images").list(id);
      if (files?.length) await supabase.storage.from("canvas_images").remove(files.map(f => `${id}/${f.name}`));
      const { error } = await supabase.from("lobbies").delete().eq("id", id);
      if (error) throw error;
      await fetchLobbies();
    } catch { setErr("Erro ao tentar dissipar o lobby."); }
  };

  // ── Entrar no lobby ───────────────────────────────────────────────────────

  const handleJoinLobby = (lob: Lobby) => {
    setErr("");
    if (!lob.isPublic && lob.ownerId !== user.username) {
      if (hashPw(joinPw[lob.id] || "") !== lob.pwHash) { setErr(`Senha incorreta para: ${lob.name}`); return; }
    }
    onEnterLobby(lob);
  };

  // ── Tela de edição de personagem ──────────────────────────────────────────

  if (showCE) return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "20px" }}>
      <button onClick={() => { setShowCE(false); setEditChar(null); }} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", marginBottom: "16px", fontSize: "14px" }}>← Voltar</button>
      <CharEditor char={editChar} owner={user.username} onSave={async c => { await onSaveChar(c); setShowCE(false); setEditChar(null); }} onCancel={() => { setShowCE(false); setEditChar(null); }} />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#1e293b", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #334155" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", letterSpacing: "0.5px" }}>LOGADO COMO</div>
          <div style={{ fontWeight: "bold", color: "#f59e0b", fontSize: "16px" }}>🧙‍♂️ {user.username}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {totalAtivos > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "20px", padding: "3px 10px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
              <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: "bold" }}>{totalAtivos} online</span>
            </div>
          )}
          <button onClick={onLogout} style={{ background: "transparent", color: "#64748b", border: "1px solid #334155", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "13px" }}>Sair</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#111827", borderBottom: "2px solid #1e293b" }}>
        <button onClick={() => setSubTab("lobbies")} style={{ flex: 1, padding: "14px", background: "none", border: "none", borderBottom: subTab === "lobbies" ? "3px solid #f59e0b" : "3px solid transparent", color: subTab === "lobbies" ? "#f59e0b" : "#64748b", cursor: "pointer", fontWeight: "bold" }}>🌐 Lobbies Ativos</button>
        <button onClick={() => setSubTab("chars")} style={{ flex: 1, padding: "14px", background: "none", border: "none", borderBottom: subTab === "chars" ? "3px solid #f59e0b" : "3px solid transparent", color: subTab === "chars" ? "#f59e0b" : "#64748b", cursor: "pointer", fontWeight: "bold" }}>⚔️ Personagens ({chars.length})</button>
      </div>

      <div style={{ maxWidth: "560px", margin: "0 auto", padding: "20px" }}>
        {err && <div style={{ color: "#f87171", fontSize: "13px", padding: "10px", background: "#1c0a0a", borderRadius: "6px", marginBottom: "14px" }}>⚠️ {err}</div>}

        {/* ── ABA: LOBBIES ── */}
        {subTab === "lobbies" && (
          <div style={{ display: "grid", gap: "16px" }}>

            {/* ── Formulário colapsável ── */}
            <div style={{ background: "#1e293b", borderRadius: "12px", overflow: "hidden", border: "1px solid #334155" }}>
              <button onClick={() => setShowCreation(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", color: "#f59e0b" }}>
                <span style={{ fontWeight: "bold", fontFamily: "Georgia", fontSize: "15px" }}>✨ Conjurar Nova Mesa</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{showCreation ? "▲ fechar" : "▼ abrir"}</span>
              </button>
              {showCreation && (
                <div style={{ padding: "0 16px 16px", display: "grid", gap: "12px", borderTop: "1px solid #334155" }}>
                  <div style={{ height: "12px" }} />
                  <input style={I} value={newLobbyName} onChange={e => setNewLobbyName(e.target.value)} placeholder="Nome do Lobby / Campanha" />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setIsPublic(true)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: isPublic ? "#f59e0b" : "#111827", color: isPublic ? "#111" : "#64748b", fontWeight: "bold", cursor: "pointer" }}>🔓 Pública</button>
                    <button onClick={() => setIsPublic(false)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: !isPublic ? "#ef4444" : "#111827", color: !isPublic ? "#fff" : "#64748b", fontWeight: "bold", cursor: "pointer" }}>🔒 Privada</button>
                  </div>
                  {!isPublic && <input type="password" style={I} value={newLobbyPw} onChange={e => setNewLobbyPw(e.target.value)} placeholder="Defina a senha de entrada" />}
                  <button onClick={handleCreateLobby} disabled={loading} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "10px", fontWeight: "bold", cursor: loading ? "wait" : "pointer" }}>
                    {loading ? "Criando..." : "Abrir Mesa de Jogo"}
                  </button>
                </div>
              )}
            </div>

            {/* ── Suas Mesas ── */}
            {myLobbies.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "11px", color: "#f59e0b", fontWeight: "bold", letterSpacing: "0.8px" }}>SUAS MESAS</span>
                  <div style={{ flex: 1, height: "1px", background: "rgba(245,158,11,0.2)" }} />
                  <span style={{ fontSize: "10px", color: "#475569" }}>{myLobbies.length}</span>
                </div>
                {myLobbies.map(l => (
                  <LobbyCard key={l.id} l={l} isOwner activity={activityPerLobby[l.id] ?? VAZIO} joinPw={joinPw[l.id] || ""} onJoinPwChange={v => setJoinPw(p => ({ ...p, [l.id]: v }))} onJoin={() => handleJoinLobby(l)} onDelete={() => handleDeleteLobby(l.id)} />
                ))}
              </div>
            )}

            {/* ── Mesas Online com busca, filtros e paginação ── */}
            <div>
              {/* Cabeçalho da seção */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold", letterSpacing: "0.8px" }}>
                  MESAS ONLINE
                </span>
                {filteredOtherLobbies.length !== lobbies.filter(l => l.ownerId !== user.username).length ? (
                  <span style={{ fontSize: "10px", color: "#3b82f6" }}>
                    {filteredOtherLobbies.length} resultado{filteredOtherLobbies.length !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span style={{ fontSize: "10px", color: "#475569" }}>
                    {filteredOtherLobbies.length}
                  </span>
                )}
                <div style={{ flex: 1, height: "1px", background: "#1e293b" }} />
                {lastRefresh && (
                  <button onClick={fetchLobbies} title="Atualizar" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "10px", color: "#374151", display: "flex", alignItems: "center", gap: "4px", padding: 0 }}>
                    ↺ {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </button>
                )}
              </div>

              {/* ── Barra de busca ── */}
              <div style={{ position: "relative", marginBottom: "10px" }}>
                <span style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", fontSize: "14px", pointerEvents: "none", color: "#475569" }}>🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou criador..."
                  style={{ ...I, paddingLeft: "34px", paddingRight: searchQuery ? "34px" : "10px" }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: "#475569", fontSize: "14px", padding: 0, lineHeight: 1 }}
                  >✕</button>
                )}
              </div>

              {/* ── Filtros + Ordenação ── */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
                {/* Chips de filtro */}
                {(["todas", "ativas", "publicas", "privadas"] as FilterType[]).map(f => {
                  const labels: Record<FilterType, string> = { todas: "Todas", ativas: "🟢 Ativas", publicas: "🔓 Públicas", privadas: "🔒 Privadas" };
                  const isOn = filterType === f;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilterType(f)}
                      style={{ padding: "4px 10px", borderRadius: "20px", border: `1px solid ${isOn ? "#f59e0b" : "#334155"}`, background: isOn ? "rgba(245,158,11,0.12)" : "transparent", color: isOn ? "#f59e0b" : "#64748b", fontSize: "11px", fontWeight: isOn ? "bold" : "normal", cursor: "pointer", whiteSpace: "nowrap" as const }}
                    >{labels[f]}</button>
                  );
                })}

                {/* Divisor */}
                <div style={{ flex: 1 }} />

                {/* Ordenação */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontSize: "10px", color: "#475569", whiteSpace: "nowrap" as const }}>ordenar:</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortType)}
                    style={{ background: "#111827", border: "1px solid #334155", borderRadius: "6px", color: "#94a3b8", fontSize: "11px", padding: "4px 6px", cursor: "pointer" }}
                  >
                    <option value="atividade">Atividade</option>
                    <option value="nome">Nome A–Z</option>
                    <option value="recente">Mais recente</option>
                  </select>
                </div>
              </div>

              {/* ── Lista paginada ── */}
              {paginatedLobbies.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 20px", color: "#334155", background: "#111827", borderRadius: "12px", border: "1px dashed #1e293b" }}>
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>
                    {searchQuery || filterType !== "todas" ? "🔎" : "🌑"}
                  </div>
                  <div style={{ fontWeight: "bold", color: "#374151", marginBottom: "4px" }}>
                    {searchQuery || filterType !== "todas" ? "Nenhum resultado" : "Nenhuma mesa ativa"}
                  </div>
                  <div style={{ fontSize: "12px" }}>
                    {searchQuery ? `Nada encontrado para "${searchQuery}".` : filterType !== "todas" ? "Tente outro filtro." : "Abra a primeira sessão deste plano astral."}
                  </div>
                  {(searchQuery || filterType !== "todas") && (
                    <button
                      onClick={() => { setSearchQuery(""); setFilterType("todas"); }}
                      style={{ marginTop: "10px", background: "transparent", border: "1px solid #334155", borderRadius: "6px", color: "#64748b", padding: "5px 12px", cursor: "pointer", fontSize: "12px" }}
                    >Limpar filtros</button>
                  )}
                </div>
              ) : (
                <>
                  {paginatedLobbies.map(l => (
                    <LobbyCard key={l.id} l={l} isOwner={false} activity={activityPerLobby[l.id] ?? VAZIO} joinPw={joinPw[l.id] || ""} onJoinPwChange={v => setJoinPw(p => ({ ...p, [l.id]: v }))} onJoin={() => handleJoinLobby(l)} onDelete={() => handleDeleteLobby(l.id)} />
                  ))}
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={filteredOtherLobbies.length}
                    onPrev={() => setCurrentPage(p => Math.max(1, p - 1))}
                    onNext={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    onPage={setCurrentPage}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* ── ABA: PERSONAGENS ── */}
        {subTab === "chars" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ color: "#f59e0b", margin: 0, fontFamily: "Georgia" }}>Armaria de Heróis</h3>
              <button onClick={() => { setEditChar(null); setShowCE(true); }} style={{ background: "#22c55e", color: "#111", border: "none", borderRadius: "6px", padding: "8px 14px", fontWeight: "bold", cursor: "pointer", fontSize: "13px" }}>➕ Criar Personagem</button>
            </div>
            {chars.length === 0 && <div style={{ fontStyle: "italic", color: "#374151", textAlign: "center", padding: "40px" }}>Nenhum herói forjado ainda.</div>}
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
                          <div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}>
                            <div style={{ background: c.hp / c.hpMax > .5 ? "#22c55e" : c.hp / c.hpMax > .25 ? "#eab308" : "#ef4444", width: `${Math.min(100, (c.hp / c.hpMax) * 100)}%`, height: "100%", borderRadius: "4px" }} />
                          </div>
                        </div>
                        {c.vigorMax > 0 && (
                          <div>
                            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "2px" }}>
                              {(c.bonuses as any).resourceName === "Mana" ? "💧" : "⚡"} {c.vigor}/{c.vigorMax}
                            </div>
                            <div style={{ background: "#0f172a", borderRadius: "4px", height: "5px" }}>
                              <div style={{ background: (c.bonuses as any).resourceName === "Mana" ? "#3b82f6" : "#f59e0b", width: `${Math.min(100, (c.vigor / c.vigorMax) * 100)}%`, height: "100%", borderRadius: "4px" }} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                        {ATTRS.map(a => { const bv = (c.bonuses as any)[a.key] || 0; return <span key={a.key} style={{ background: "#0f172a", borderRadius: "4px", padding: "2px 5px", fontSize: "10px", color: bc(bv) }}>{a.short}: {bv >= 0 ? "+" : ""}{bv}</span>; })}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", minWidth: "40px", flexShrink: 0 }}>
                      <button onClick={() => { setEditChar(c); setShowCE(true); }} style={{ background: "#111827", color: "#94a3b8", border: "1px solid #374151", borderRadius: "6px", padding: "6px", cursor: "pointer", fontSize: "13px" }}>✏️</button>
                      <button onClick={() => setDelC(c.id)} style={{ background: "#1c0a0a", color: "#ef4444", border: "1px solid #ef4444", borderRadius: "6px", padding: "6px", cursor: "pointer", fontSize: "13px" }}>🗑️</button>
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