// src/App.tsx
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

  const loadChars = async (uname: string) => {
    try {
      // @ts-ignore
      const r = await window.storage.list(`rpg_char:${uname}:`, true);
      if (r?.keys?.length) {
        // @ts-ignore
        const loaded = (await Promise.all(r.keys.map(async (k: string) => { try { const d = await window.storage.get(k, true); return d ? JSON.parse(d.value) : null; } catch { return null; } }))).filter(Boolean);
        setChars(loaded);
      } else setChars([]);
    } catch { setChars([]); }
  };

  const saveChar = async (c: Character) => {
    if (!user) return;
    const ch = { ...c, owner: user.username };
    setChars(p => p.find(x => x.id === ch.id) ? p.map(x => x.id === ch.id ? ch : x) : [...p, ch]);
    // @ts-ignore
    try { await window.storage.set(`rpg_char:${user.username}:${ch.id}`, JSON.stringify(ch), true); } catch {}
  };

  const deleteChar = async (id: string) => {
    if (!user) return;
    setChars(p => p.filter(c => c.id !== id));
    // @ts-ignore
    try { await window.storage.delete(`rpg_char:${user.username}:${id}`, true); } catch {}
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
      <CharEditor char={null} owner={user?.username || ""} onSave={async c => { await saveChar(c); setCreatingChar(false); }} onCancel={() => setCreatingChar(false)} />
    </div>
  );

  if (screen === "login") return <LoginScreen onLogin={async u => { setUser(u); await loadChars(u.username); setScreen("lobbies"); }} />;
  if (screen === "lobbies" && user) return <LobbyBrowser user={user} chars={chars} onEnterLobby={l => { setLobby(l); setScreen("role"); }} onLogout={logout} onSaveChar={saveChar} onDeleteChar={deleteChar} />;
  if (screen === "role" && user && lobby) return <RoleSelect user={user} lobby={lobby} chars={chars} onJoin={m => { setMember(m); setScreen("game"); }} onCreateChar={() => setCreatingChar(true)} onBack={() => setScreen("lobbies")} />;
  if (screen === "game" && user && lobby && member) return <GameScreen user={user} lobby={lobby} member={member} chars={chars} onLeave={async () => { // @ts-ignore
    try { await window.storage.delete(`rpg_mem:${lobby.id}:${user.username}`, true); await window.storage.delete("rpg_cur"); } catch {} setMember(null); setScreen("lobbies"); }} onSaveChar={saveChar} onDeleteChar={deleteChar} />;
  
  return null;
}