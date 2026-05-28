// src/components/CharEditor.tsx
import { useState } from "react";
import type { Character, Skill } from "../types";
import { I, ATTRS } from "../utils/constants";

const fBon = () => ({for:0,des:0,con:0,int:0,sab:0,car:0,sob:0,sor:0,fe:0});
const mkId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fSkill = (): Skill => ({id:mkId(),name:"",type:"ativa",description:"",cost:"",damage:"",cooldown:""});
const fChar = (own: string): Character => ({id:mkId(),owner:own,name:"",classe:"",raca:"",nivel:1,hp:10,hpMax:10,vigor:0,vigorMax:0,bonuses:fBon(),skills:[],notes:""});

const SI = {...I,padding:"6px 8px",fontSize:"13px"};

function SkillEditor({skills = [], onChange}: {skills: Skill[], onChange: (s: Skill[]) => void}) {
  const add = () => onChange([...skills, fSkill()]);
  const upd = (id: string, k: keyof Skill, v: string) => onChange(skills.map(s => s.id === id ? { ...s, [k]: v } : s));
  const del = (id: string) => onChange(skills.filter(s => s.id !== id));
  
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
        <label style={{color:"#f59e0b",fontSize:"13px",fontWeight:"bold"}}>⚡ Habilidades ({skills.length})</label>
        <button onClick={add} style={{background:"#1e3a5f",color:"#60a5fa",border:"1px solid #1e40af",borderRadius:"6px",padding:"4px 10px",cursor:"pointer",fontSize:"12px"}}>+ Add</button>
      </div>
      {skills.map(s => (
        <div key={s.id} style={{background:"#111827",borderRadius:"8px",padding:"10px",marginBottom:"8px",border:"1px solid #1f2937"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 90px auto",gap:"6px",marginBottom:"6px"}}>
            <input style={SI} placeholder="Nome" value={s.name} onChange={e => upd(s.id,"name",e.target.value)}/>
            <select style={SI} value={s.type} onChange={e => upd(s.id,"type",e.target.value)}>
              {["passiva","ativa","ataque","especial"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => del(s.id)} style={{background:"transparent",color:"#ef4444",border:"none",cursor:"pointer",fontSize:"18px",padding:"0 4px"}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginBottom:"6px"}}>
            {[["cost","Custo","60 Vigor"],["damage","Dano","2d6+2"],["cooldown","Recarga","3 turnos"]].map(([k,l,p]) => (
              <div key={k}><div style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>{l.toUpperCase()}</div>
              <input style={SI} placeholder={p} value={s[k as keyof Skill]} onChange={e => upd(s.id, k as keyof Skill, e.target.value)}/></div>
            ))}
          </div>
          <textarea style={{...SI,minHeight:"48px",resize:"vertical"}} placeholder="Descrição..." value={s.description} onChange={e => upd(s.id,"description",e.target.value)}/>
        </div>
      ))}
      {!skills.length && <div style={{textAlign:"center",color:"#374151",fontSize:"12px",padding:"10px"}}>Nenhuma habilidade.</div>}
    </div>
  );
}

interface CharEditorProps {
  char: Character | null;
  owner: string;
  onSave: (c: Character) => void;
  onCancel: () => void;
}

export default function CharEditor({char, owner, onSave, onCancel}: CharEditorProps) {
  const [c, setC] = useState<Character>(() => ({ ...fChar(owner), ...char, bonuses: { ...fBon(), ...(char?.bonuses || {}) }, skills: char?.skills ?? [] }));
  
  const set = (k: keyof Character, v: any) => setC(p => ({ ...p, [k]: v }));
  const setB = (k: string, v: string) => setC(p => ({ ...p, bonuses: { ...p.bonuses, [k]: parseInt(v) || 0 } }));
  
  return (
    <div style={{background:"#1f2937",borderRadius:"12px",padding:"16px",maxWidth:"540px",margin:"0 auto"}}>
      <h3 style={{color:"#f59e0b",margin:"0 0 12px",fontFamily:"Georgia"}}>{char?.id ? "✏️ Editar" : "⚔️ Novo"} Personagem</h3>
      <div style={{display:"grid",gap:"10px"}}>
        <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>NOME</label>
          <input style={I} value={c.name} onChange={e => set("name",e.target.value)} placeholder="Nome do personagem"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 70px",gap:"8px"}}>
          {[["classe","CLASSE","Guerreiro"],["raca","RAÇA","Humano"]].map(([k,l,p]) => (
            <div key={k}><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>{l}</label>
            <input style={I} value={c[k as keyof Character] as string} onChange={e => set(k as keyof Character,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>NÍVEL</label>
          <input style={I} type="number" min="1" value={c.nivel} onChange={e => set("nivel",Math.max(1,parseInt(e.target.value)||1))}/></div>
        </div>
        <div>
          {/* 🔮 TRUQUE DE MESTRE: Botões de Escolha de Energia */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ color: "#9ca3af", fontSize: "11px", fontWeight: "bold" }}>ENERGIA:</label>
            <button onClick={() => setC(p => ({...p, bonuses: {...p.bonuses, resourceName: "Vigor"} as any}))} style={{ flex: 1, background: (c.bonuses as any).resourceName === "Mana" ? "#111827" : "#f59e0b", color: (c.bonuses as any).resourceName === "Mana" ? "#64748b" : "#111", border: (c.bonuses as any).resourceName === "Mana" ? "1px solid #334155" : "none", borderRadius: "6px", padding: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px", transition: ".2s" }}>⚡ Vigor</button>
            <button onClick={() => setC(p => ({...p, bonuses: {...p.bonuses, resourceName: "Mana"} as any}))} style={{ flex: 1, background: (c.bonuses as any).resourceName === "Mana" ? "#3b82f6" : "#111827", color: (c.bonuses as any).resourceName === "Mana" ? "#fff" : "#64748b", border: (c.bonuses as any).resourceName !== "Mana" ? "1px solid #334155" : "none", borderRadius: "6px", padding: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "12px", transition: ".2s" }}>💧 Mana</button>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"8px"}}>
            {[
              ["hp", "❤️ HP"],
              ["hpMax", "MÁXIMO"],
              ["vigor", (c.bonuses as any).resourceName === "Mana" ? "💧 MANA" : "⚡ VIGOR"],
              ["vigorMax", "MÁXIMO"]
            ].map(([k,l]) => (
              <div key={k}><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>{l}</label>
              <input style={I} type="number" value={c[k as keyof Character] as number} onChange={e => set(k as keyof Character, parseInt(e.target.value)||0)}/></div>
            ))}
          </div>
        </div>
        <div>
          <label style={{color:"#f59e0b",fontSize:"13px",fontWeight:"bold",display:"block",marginBottom:"6px"}}>🎯 Bônus de Atributos</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"6px"}}>
            {ATTRS.map(a => (
              <div key={a.key} style={{background:"#111827",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <div style={{color:"#f59e0b",fontSize:"11px",fontWeight:"bold",marginBottom:"4px"}}>{a.short}</div>
                <input type="number" style={{...I,textAlign:"center",padding:"4px",width:"56px"}} value={c.bonuses[a.key]} onChange={e => setB(a.key,e.target.value)}/>
              </div>
            ))}
          </div>
        </div>
        <SkillEditor skills={c.skills} onChange={sk => set("skills", sk)}/>
        <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>ANOTAÇÕES</label>
        <textarea style={{...I,minHeight:"56px",resize:"vertical"}} value={c.notes} onChange={e => set("notes",e.target.value)} placeholder="Inventário, história..."/></div>
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={() => onSave(c)} style={{flex:1,background:"#f59e0b",color:"#111",border:"none",borderRadius:"8px",padding:"10px",fontWeight:"bold",cursor:"pointer",fontSize:"15px"}}>💾 Salvar</button>
          <button onClick={onCancel} style={{flex:1,background:"#374151",color:"#e5e7eb",border:"none",borderRadius:"8px",padding:"10px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}