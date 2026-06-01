// src/App.tsx
import { supabase } from "./lib/supabase";
import { useState, useEffect, useCallback } from "react";
import type { User, Lobby, Character, Member } from "./types";
import LoginScreen from "./components/LoginScreen";
import LobbyBrowser from "./components/LobbyBrowser";
import RoleSelect from "./components/RoleSelect";
import GameScreen from "./components/GameScreen";
import CharEditor from "./components/CharEditor";
import { isSessionValid } from "./utils/security";

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user, setUser]     = useState<User | null>(null);
  const [lobby, setLobby]   = useState<Lobby | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [chars, setChars]   = useState<Character[]>([]);
  const [creatingChar, setCreatingChar] = useState(false);

  const loadChars = useCallback(async (uname: string, pwHash: string) => {
    try {
      const { data: loaded, error } = await supabase.rpc("buscar_meus_personagens", {
        p_username: uname,
        p_pwhash:   pwHash,
      });
      if (error) throw error;
      if (loaded) {
        const adaptados = loaded.map((c: any) => ({
          id: c.id, owner: c.owner, name: c.name, classe: c.classe, raca: c.raca,
          nivel: c.nivel, hp: c.hp, hpMax: c.hp_max, vigor: c.vigor, vigorMax: c.vigor_max,
          bonuses: c.bonuses, skills: c.skills, notes: c.notes,
        }));
        setChars(adaptados);
      } else {
        setChars([]);
      }
    } catch (e) {
      console.error("Erro ao buscar personagens:", e);
      setChars([]);
    }
  }, []);

  // ── Restauração de sessão ─────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const raw = await window.storage.get("rpg_sess");
        if (raw) {
          const parsed = JSON.parse(raw.value);

          // ✅ NOVO: verifica expiração antes de restaurar.
          // Sessões antigas (sem expiresAt) são tratadas como expiradas.
          if (!isSessionValid(parsed)) {
            // Limpa sessão expirada silenciosamente e vai para login
            await window.storage.delete("rpg_sess");
            await window.storage.delete("rpg_cur");
            setScreen("login");
            return;
          }

          const { username, pwHash } = parsed;
          if (username && pwHash) {
            setUser({ username, pwHash, createdAt: 0 });
            await loadChars(username, pwHash);
            try {
              const cr = await window.storage.get("rpg_cur");
              if (cr) {
                const cs = JSON.parse(cr.value);
                const lr = await window.storage.get(`rpg_lob:${cs.lobbyId}`);
                if (lr) {
                  setLobby(JSON.parse(lr.value));
                  setMember(cs);
                  setScreen("game");
                  return;
                }
              }
            } catch {}
            setScreen("lobbies");
            return;
          }
        }
      } catch (e) {
        console.error("Erro na restauração de sessão:", e);
      }
      setScreen("login");
    })();
  }, [loadChars]);

  const saveChar = useCallback(async (c: Character) => {
    if (!user) return;
    const ch = { ...c, owner: user.username };
    setChars(p => p.find(x => x.id === ch.id) ? p.map(x => x.id === ch.id ? ch : x) : [...p, ch]);
    try {
      const { error } = await supabase.rpc("salvar_meu_personagem", {
        p_username: user.username, p_pwhash: user.pwHash, p_id: ch.id,
        p_name: ch.name, p_classe: ch.classe, p_raca: ch.raca, p_nivel: ch.nivel,
        p_hp: ch.hp, p_hp_max: ch.hpMax, p_vigor: ch.vigor, p_vigor_max: ch.vigorMax,
        p_bonuses: ch.bonuses, p_skills: ch.skills, p_notes: ch.notes,
      });
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao salvar personagem:", e);
      if (user) await loadChars(user.username, user.pwHash);
      alert("⚠️ A conexão falhou. Suas últimas alterações no personagem não foram salvas.");
    }
  }, [user, loadChars]);

  const deleteChar = useCallback(async (id: string) => {
    if (!user) return;
    setChars(p => p.filter(c => c.id !== id));
    try {
      const { error } = await supabase.rpc("deletar_meu_personagem", {
        p_username: user.username, p_pwhash: user.pwHash, p_id: id,
      });
      if (error) throw error;
    } catch (e) {
      console.error("Erro ao deletar personagem:", e);
      await loadChars(user.username, user.pwHash);
      alert("⚠️ Erro de conexão. O personagem não pôde ser apagado do servidor.");
    }
  }, [user, loadChars]);

  const logout = useCallback(async () => {
    try { await window.storage.delete("rpg_sess"); } catch {}
    if (member && lobby) {
      try {
        await window.storage.delete(`rpg_lob:${lobby.id}`);
        await window.storage.delete("rpg_cur");
      } catch {}
    }
    setUser(null); setLobby(null); setMember(null); setChars([]); setScreen("login");
  }, [member, lobby]);

  // ── Screens ───────────────────────────────────────────────────────────────

  if (screen === "loading") return (
    <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", fontSize: "40px" }}>🎲</div>
  );

  if (creatingChar) return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "20px", fontFamily: "'Segoe UI',sans-serif" }}>
      <button onClick={() => setCreatingChar(false)} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", marginBottom: "16px", fontSize: "14px" }}>← Voltar</button>
      <CharEditor char={null} owner={user?.username || ""} onSave={async c => { await saveChar(c); setCreatingChar(false); }} onCancel={() => setCreatingChar(false)} />
    </div>
  );

  if (screen === "login") return (
    <LoginScreen onLogin={async u => {
      setUser(u);
      await loadChars(u.username, u.pwHash);
      setScreen("lobbies");
    }} />
  );

  if (screen === "lobbies" && user) return (
    <LobbyBrowser user={user} chars={chars} onEnterLobby={l => { setLobby(l); setScreen("role"); }} onLogout={logout} onSaveChar={saveChar} onDeleteChar={deleteChar} />
  );

  if (screen === "role" && user && lobby) return (
    <RoleSelect user={user} lobby={lobby} chars={chars} onJoin={m => { setMember(m); setScreen("game"); }} onCreateChar={() => setCreatingChar(true)} onBack={() => setScreen("lobbies")} />
  );

  if (screen === "game" && user && lobby && member) return (
    <GameScreen
      user={user} lobby={lobby} member={member} chars={chars}
      onLeave={async () => {
        try {
          await supabase.from("members").delete().eq("lobby_id", lobby.id).eq("username", user.username);
          await window.storage.delete(`rpg_lob:${lobby.id}`);
          await window.storage.delete("rpg_cur");
        } catch {}
        setMember(null); setScreen("lobbies");
      }}
      onSaveChar={saveChar} onDeleteChar={deleteChar} onUpdateMember={setMember}
    />
  );

  return null;
}