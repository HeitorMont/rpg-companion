// src/App.tsx
import { supabase } from "./lib/supabase";
import { useState, useEffect } from "react";
import type { User, Lobby, Character, Member } from "./types";
import LoginScreen from "./components/LoginScreen";
import LobbyBrowser from "./components/LobbyBrowser";
import RoleSelect from "./components/RoleSelect";
import GameScreen from "./components/GameScreen";
import CharEditor from "./components/CharEditor";

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [user, setUser] = useState<User | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [chars, setChars] = useState<Character[]>([]);
  const [creatingChar, setCreatingChar] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // @ts-ignore
        const s = await window.storage.get("rpg_sess");
        if (s) {
          const { username, pwHash } = JSON.parse(s.value);
          try {
            // @ts-ignore
            const ur = await window.storage.get(`rpg_user:${username.toLowerCase()}`, true);
            if (ur) {
              const u = JSON.parse(ur.value);
              if (u.pwHash === pwHash) {
                setUser(u); await loadChars(u.username);
                try {
                  // @ts-ignore
                  const cr = await window.storage.get("rpg_cur");
                  if (cr) { 
                    const cs = JSON.parse(cr.value); 
                    // @ts-ignore
                    const lr = await window.storage.get(`rpg_lob:${cs.lobbyId}`, true); 
                    if (lr) { setLobby(JSON.parse(lr.value)); setMember(cs); setScreen("game"); return; } 
                  }
                } catch {}
                setScreen("lobbies"); return;
              }
            }
          } catch {}
        }
      } catch {}
      setScreen("login");
    })();
  }, []);

  // 🔮 Carrega todas as fichas do usuário direto da nuvem
  const loadChars = async (uname: string) => {
    try {
      const { data: loaded, error } = await supabase
        .from("characters")
        .select("*")
        .eq("owner", uname);

      if (error) throw error;

      if (loaded) {
        const adaptados = loaded.map(c => ({
          id: c.id,
          owner: c.owner,
          name: c.name,
          classe: c.classe,
          raca: c.raca,
          nivel: c.nivel,
          hp: c.hp,
          hpMax: c.hp_max, 
          vigor: c.vigor,
          vigorMax: c.vigor_max, 
          bonuses: c.bonuses,
          skills: c.skills,
          notes: c.notes
        }));
        setChars(adaptados);
      } else {
        setChars([]);
      }
    } catch {
      setChars([]);
    }
  };

  // 🔮 Salva ou atualiza uma ficha na nuvem em tempo real
  const saveChar = async (c: Character) => {
    if (!user) return;
    const ch = { ...c, owner: user.username };
    
    setChars(p => p.find(x => x.id === ch.id) ? p.map(x => x.id === ch.id ? ch : x) : [...p, ch]);

    try {
      const payload = {
        id: ch.id,
        owner: ch.owner,
        name: ch.name,
        classe: ch.classe,
        raca: ch.raca,
        nivel: ch.nivel,
        hp: ch.hp,
        hp_max: ch.hpMax,
        vigor: ch.vigor,
        vigor_max: ch.vigorMax,
        bonuses: ch.bonuses,
        skills: ch.skills,
        notes: ch.notes
      };

      const { error } = await supabase
        .from("characters")
        .upsert(payload);

      if (error) throw error;
    } catch (e) {
      console.error("Erro ao salvar personagem no Supabase:", e);
    }
  };

  // 🔮 Deleta a ficha permanentemente do banco online
  const deleteChar = async (id: string) => {
    if (!user) return;
    setChars(p => p.filter(c => c.id !== id));
    
    try {
      const { error } = await supabase
        .from("characters")
        .delete()
        .eq("id", id);

      if (error) throw error;
    } catch (e) {
      console.error("Erro ao deletar personagem no Supabase:", e);
    }
  };

  const logout = async () => {
    // @ts-ignore
    try { await window.storage.delete("rpg_sess"); } catch {}
    if (member && lobby && user) { 
      // @ts-ignore
      try { await window.storage.delete(`rpg_mem:${lobby.id}:${user.username}`, true); await window.storage.delete("rpg_cur"); } catch {} 
    }
    setUser(null); setLobby(null); setMember(null); setChars([]); setScreen("login");
  };

  if (screen === "loading") return <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", fontSize: "40px" }}>🎲</div>;

  if (creatingChar) return (
    <div style={{ background: "#0f172a", minHeight: "100vh", padding: "20px", fontFamily: "'Segoe UI',sans-serif" }}>
      <button onClick={() => setCreatingChar(false)} style={{ background: "transparent", color: "#64748b", border: "none", cursor: "pointer", marginBottom: "16px", fontSize: "14px" }}>← Voltar</button>
      <CharEditor char={null} owner={user?.username || ""} onSave={async c => { await saveChar(c); setCreatingChar(false); }} onCancel={() => { setCreatingChar(false); }} />
    </div>
  );

  if (screen === "login") return <LoginScreen onLogin={async u => { setUser(u); await loadChars(u.username); setScreen("lobbies"); }} />;
  if (screen === "lobbies" && user) return <LobbyBrowser user={user} chars={chars} onEnterLobby={l => { setLobby(l); setScreen("role"); }} onLogout={logout} onSaveChar={saveChar} onDeleteChar={deleteChar} />;
  if (screen === "role" && user && lobby) return <RoleSelect user={user} lobby={lobby} chars={chars} onJoin={m => { setMember(m); setScreen("game"); }} onCreateChar={() => setCreatingChar(true)} onBack={() => setScreen("lobbies")} />;
  if (screen === "game" && user && lobby && member) return (
    <GameScreen 
      user={user} 
      lobby={lobby} 
      member={member} 
      chars={chars} 
      onLeave={async () => { 
        try {
          await supabase
            .from("members")
            .delete()
            .eq("lobby_id", lobby.id)
            .eq("username", user.username);
          // @ts-ignore
          await window.storage.delete(`rpg_mem:${lobby.id}:${user.username}`, true); 
          // @ts-ignore
          await window.storage.delete("rpg_cur"); 
        } catch {} 
        setMember(null); 
        setScreen("lobbies"); 
      }} 
      onSaveChar={saveChar} 
      onDeleteChar={deleteChar}
      onUpdateMember={setMember} // 🔮 Escuta reativa de transmutação de papéis
    />
  );
  
  return null;
}