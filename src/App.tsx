import { useState, useRef, useEffect, useCallback } from "react";

const DICE=[4,6,8,10,12,20,100];
const ATTRS=[
  {key:"for",short:"FOR",label:"Força"},{key:"des",short:"DES",label:"Destreza"},
  {key:"con",short:"CON",label:"Constituição"},{key:"int",short:"INT",label:"Inteligência"},
  {key:"sab",short:"SAB",label:"Sabedoria"},{key:"car",short:"CAR",label:"Carisma"},
  {key:"sob",short:"SOB",label:"Sobrevivência"},{key:"sor",short:"SOR",label:"Sorte"},
  {key:"fe",short:"FÉ",label:"Fé"},
];
const fBon=()=>({for:0,des:0,con:0,int:0,sab:0,car:0,sob:0,sor:0,fe:0});
const mkId=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const fSkill=()=>({id:mkId(),name:"",type:"ativa",description:"",cost:"",damage:"",cooldown:""});
const fChar=own=>({id:mkId(),owner:own,name:"",classe:"",raca:"",nivel:1,hp:10,hpMax:10,vigor:0,vigorMax:0,bonuses:fBon(),skills:[],notes:""});
const hashPw=s=>{let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h)^s.charCodeAt(i);return(h>>>0).toString(36);};
const bc=v=>v>0?"#4ade80":v<0?"#f87171":"#475569";
const PAL=["#ef4444","#3b82f6","#22c55e","#eab308","#a855f7","#f97316","#ffffff","#94a3b8"];
const TC={passiva:"#60a5fa",ativa:"#f59e0b",ataque:"#ef4444",especial:"#a855f7"};
const TI={passiva:"🛡️",ativa:"⚡",ataque:"⚔️",especial:"✨"};
const I={background:"#111827",border:"1px solid #374151",borderRadius:"8px",padding:"8px 10px",color:"#e5e7eb",fontSize:"14px",width:"100%",boxSizing:"border-box"};
const SI={...I,padding:"6px 8px",fontSize:"13px"};

/* ── ImageObject ─────────────────────────────────────── */
function ImageObject({img, selected, canSelect, onSelect, onUpdate, onDelete, onToggleLayer, onMoveGroup}){
  const HANDLES=[
    {id:"tl",cx:0,cy:0,cur:"nw-resize"},{id:"tc",cx:.5,cy:0,cur:"n-resize"},
    {id:"tr",cx:1,cy:0,cur:"ne-resize"},{id:"ml",cx:0,cy:.5,cur:"w-resize"},
    {id:"mr",cx:1,cy:.5,cur:"e-resize"},{id:"bl",cx:0,cy:1,cur:"sw-resize"},
    {id:"bc",cx:.5,cy:1,cur:"s-resize"},{id:"br",cx:1,cy:1,cur:"se-resize"},
  ];

  // MAGIA VISUAL: Define a cor baseada na camada atual da imagem
  // Azul para Tokens (Frente) e Laranja para Mapas (Fundo)
  const themeColor = img.layer === "map" ? "#f59e0b" : "#3b82f6";

  const startInteraction=(e,type,hid)=>{
    e.stopPropagation(); onSelect();
    const isT=!!e.touches; const src=isT?e.touches[0]:e;
    const sx=src.clientX,sy=src.clientY,si={...img};
    
    let lastX = sx, lastY = sy; 

    const onMove=ev=>{
      const p=ev.touches?ev.touches[0]:ev;
      
      if(type==="move"){
        const dx = p.clientX - lastX;
        const dy = p.clientY - lastY;
        lastX = p.clientX; lastY = p.clientY;
        if(onMoveGroup) onMoveGroup(dx, dy);
        return;
      }
      
      const dx=p.clientX-sx,dy=p.clientY-sy;
      let {x,y,w,h}=si;
      if(hid.includes("l")){x=si.x+dx;w=si.w-dx;}
      if(hid.includes("r")){w=si.w+dx;}
      if(hid.includes("t")){y=si.y+dy;h=si.h-dy;}
      if(hid.includes("b")){h=si.h+dy;}
      if(w<30){if(hid.includes("l"))x=si.x+si.w-30;w=30;}
      if(h<30){if(hid.includes("t"))y=si.y+si.h-30;h=30;}
      onUpdate({...si,x,y,w,h});
    };
    const onUp=()=>{
      window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);
      window.removeEventListener("touchmove",onMove);window.removeEventListener("touchend",onUp);
    };
    window.addEventListener("mousemove",onMove);window.addEventListener("mouseup",onUp);
    window.addEventListener("touchmove",onMove,{passive:false});window.addEventListener("touchend",onUp);
  };

  return(
    <div style={{position:"absolute",left:img.x,top:img.y,width:img.w,height:img.h,
      // A borda agora muda de cor dependendo de onde a imagem está
      border:`2px solid ${selected?themeColor:"transparent"}`,boxSizing:"border-box",
      cursor:canSelect?"move":"default",userSelect:"none",
      pointerEvents:canSelect?"all":"none"}}
      onMouseDown={e=>{if(canSelect)startInteraction(e,"move",null)}}
      onTouchStart={e=>{if(canSelect)startInteraction(e,"move",null)}}>
      <img src={img.dataUrl} style={{width:"100%",height:"100%",objectFit:"fill",display:"block",pointerEvents:"none",userSelect:"none",draggable:false}} alt=""/>
      
      {selected&&<>
        {/* ETIQUETA INFORMATIVA: Aparece no topo esquerdo da seleção dizendo a camada exata */}
        <div style={{
            position: "absolute", top: -22, left: -2, 
            background: themeColor, color: "#fff", 
            padding: "2px 8px", borderRadius: "4px 4px 0 0", 
            fontSize: "11px", fontWeight: "bold", 
            pointerEvents: "none", whiteSpace: "nowrap"
        }}>
           {img.layer === "map" ? "🗺️ Fundo" : "♟️ Frente"}
        </div>

        {HANDLES.map(h=>(
          // Os pontos de redimensionamento também copiam a cor do tema
          <div key={h.id} style={{position:"absolute",left:`calc(${h.cx*100}% - 5px)`,top:`calc(${h.cy*100}% - 5px)`,
            width:10,height:10,background:themeColor,border:"2px solid white",borderRadius:"2px",cursor:h.cur,zIndex:10}}
            onMouseDown={e=>startInteraction(e,"resize",h.id)}
            onTouchStart={e=>startInteraction(e,"resize",h.id)}/>
        ))}
      </>}
    </div>
  );
}

/* ── SkillEditor ─────────────────────────────────────── */
function SkillEditor({skills=[],onChange}){
  const add=()=>onChange([...skills,fSkill()]);
  const upd=(id,k,v)=>onChange(skills.map(s=>s.id===id?{...s,[k]:v}:s));
  const del=id=>onChange(skills.filter(s=>s.id!==id));
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
        <label style={{color:"#f59e0b",fontSize:"13px",fontWeight:"bold"}}>⚡ Habilidades ({skills.length})</label>
        <button onClick={add} style={{background:"#1e3a5f",color:"#60a5fa",border:"1px solid #1e40af",borderRadius:"6px",padding:"4px 10px",cursor:"pointer",fontSize:"12px"}}>+ Add</button>
      </div>
      {skills.map(s=>(
        <div key={s.id} style={{background:"#111827",borderRadius:"8px",padding:"10px",marginBottom:"8px",border:"1px solid #1f2937"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 90px auto",gap:"6px",marginBottom:"6px"}}>
            <input style={SI} placeholder="Nome" value={s.name} onChange={e=>upd(s.id,"name",e.target.value)}/>
            <select style={SI} value={s.type} onChange={e=>upd(s.id,"type",e.target.value)}>
              {["passiva","ativa","ataque","especial"].map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={()=>del(s.id)} style={{background:"transparent",color:"#ef4444",border:"none",cursor:"pointer",fontSize:"18px",padding:"0 4px"}}>×</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginBottom:"6px"}}>
            {[["cost","Custo","60 Vigor"],["damage","Dano","2d6+2"],["cooldown","Recarga","3 turnos"]].map(([k,l,p])=>(
              <div key={k}><div style={{color:"#6b7280",fontSize:"10px",marginBottom:"2px"}}>{l.toUpperCase()}</div>
              <input style={SI} placeholder={p} value={s[k]} onChange={e=>upd(s.id,k,e.target.value)}/></div>
            ))}
          </div>
          <textarea style={{...SI,minHeight:"48px",resize:"vertical"}} placeholder="Descrição..." value={s.description} onChange={e=>upd(s.id,"description",e.target.value)}/>
        </div>
      ))}
      {!skills.length&&<div style={{textAlign:"center",color:"#374151",fontSize:"12px",padding:"10px"}}>Nenhuma habilidade.</div>}
    </div>
  );
}

/* ── CharEditor ──────────────────────────────────────── */
function CharEditor({char,owner,onSave,onCancel}){
  const [c,setC]=useState(()=>({...fChar(owner),...char,bonuses:{...fBon(),...(char?.bonuses||{})},skills:char?.skills??[]}));
  const set=(k,v)=>setC(p=>({...p,[k]:v}));
  const setB=(k,v)=>setC(p=>({...p,bonuses:{...p.bonuses,[k]:parseInt(v)||0}}));
  return(
    <div style={{background:"#1f2937",borderRadius:"12px",padding:"16px",maxWidth:"540px",margin:"0 auto"}}>
      <h3 style={{color:"#f59e0b",margin:"0 0 12px",fontFamily:"Georgia"}}>{char?.id?"✏️ Editar":"⚔️ Novo"} Personagem</h3>
      <div style={{display:"grid",gap:"10px"}}>
        <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>NOME</label>
          <input style={I} value={c.name} onChange={e=>set("name",e.target.value)} placeholder="Nome do personagem"/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 70px",gap:"8px"}}>
          {[["classe","CLASSE","Guerreiro"],["raca","RAÇA","Humano"]].map(([k,l,p])=>(
            <div key={k}><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>{l}</label>
            <input style={I} value={c[k]} onChange={e=>set(k,e.target.value)} placeholder={p}/></div>
          ))}
          <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>NÍVEL</label>
          <input style={I} type="number" min="1" value={c.nivel} onChange={e=>set("nivel",Math.max(1,parseInt(e.target.value)||1))}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"8px"}}>
          {[["hp","❤️ HP"],["hpMax","HP Máx"],["vigor","⚡ Vigor"],["vigorMax","Vigor Máx"]].map(([k,l])=>(
            <div key={k}><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>{l.toUpperCase()}</label>
            <input style={I} type="number" value={c[k]} onChange={e=>set(k,parseInt(e.target.value)||0)}/></div>
          ))}
        </div>
        <div>
          <label style={{color:"#f59e0b",fontSize:"13px",fontWeight:"bold",display:"block",marginBottom:"6px"}}>🎯 Bônus de Atributos</label>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"6px"}}>
            {ATTRS.map(a=>(
              <div key={a.key} style={{background:"#111827",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
                <div style={{color:"#f59e0b",fontSize:"11px",fontWeight:"bold",marginBottom:"4px"}}>{a.short}</div>
                <input type="number" style={{...I,textAlign:"center",padding:"4px",width:"56px"}} value={c.bonuses[a.key]} onChange={e=>setB(a.key,e.target.value)}/>
              </div>
            ))}
          </div>
        </div>
        <SkillEditor skills={c.skills} onChange={sk=>set("skills",sk)}/>
        <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold"}}>ANOTAÇÕES</label>
        <textarea style={{...I,minHeight:"56px",resize:"vertical"}} value={c.notes} onChange={e=>set("notes",e.target.value)} placeholder="Inventário, história..."/></div>
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={()=>onSave(c)} style={{flex:1,background:"#f59e0b",color:"#111",border:"none",borderRadius:"8px",padding:"10px",fontWeight:"bold",cursor:"pointer",fontSize:"15px"}}>💾 Salvar</button>
          <button onClick={onCancel} style={{flex:1,background:"#374151",color:"#e5e7eb",border:"none",borderRadius:"8px",padding:"10px",cursor:"pointer"}}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

/* ── SkillPanel ──────────────────────────────────────── */
function SkillPanel({char}){
  const [exp,setExp]=useState(null);
  if(!char?.skills?.length) return <div style={{textAlign:"center",color:"#374151",padding:"32px"}}><div style={{fontSize:"40px",marginBottom:"8px"}}>⚡</div>Nenhuma habilidade.</div>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
      {char.skills.map(s=>(
        <div key={s.id} onClick={()=>setExp(exp===s.id?null:s.id)}
          style={{background:"#1e293b",border:`1px solid ${exp===s.id?(TC[s.type]||"#f59e0b"):"#334155"}`,borderRadius:"10px",padding:"12px",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{fontSize:"18px"}}>{TI[s.type]||"⚡"}</span>
            <span style={{fontWeight:"bold",flex:1}}>{s.name}</span>
            <span style={{background:"#0f172a",borderRadius:"10px",padding:"2px 8px",fontSize:"11px",color:TC[s.type]||"#f59e0b",fontWeight:"bold"}}>{(s.type||"").toUpperCase()}</span>
            <span style={{color:"#64748b",fontSize:"12px"}}>{exp===s.id?"▲":"▼"}</span>
          </div>
          {(s.damage||s.cost||s.cooldown)&&<div style={{display:"flex",gap:"10px",marginTop:"6px",flexWrap:"wrap"}}>
            {s.damage&&<span style={{fontSize:"12px",color:"#ef4444"}}>⚔️ {s.damage}</span>}
            {s.cost&&<span style={{fontSize:"12px",color:"#3b82f6"}}>💧 {s.cost}</span>}
            {s.cooldown&&<span style={{fontSize:"12px",color:"#94a3b8"}}>⏱️ {s.cooldown}</span>}
          </div>}
          {exp===s.id&&s.description&&<div style={{marginTop:"10px",padding:"10px",background:"#0f172a",borderRadius:"8px",fontSize:"13px",color:"#94a3b8",lineHeight:"1.7",borderLeft:`3px solid ${TC[s.type]||"#f59e0b"}`,whiteSpace:"pre-line"}}>{s.description}</div>}
        </div>
      ))}
    </div>
  );
}

/* ── LoginScreen ─────────────────────────────────────── */
function LoginScreen({onLogin}){
  const [u,setU]=useState(""); const [p,setP]=useState("");
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const handle=async isReg=>{
    setErr("");
    if(!u.trim()||!p.trim()){setErr("Preencha todos os campos.");return;}
    if(u.trim().length<3){setErr("Usuário: mínimo 3 caracteres.");return;}
    if(p.length<4){setErr("Senha: mínimo 4 caracteres.");return;}
    setLoading(true);
    const key=`rpg_user:${u.trim().toLowerCase()}`;
    const pw=hashPw(p);
    try{
      let ex=null;
      try{const r=await window.storage.get(key,true);if(r)ex=JSON.parse(r.value);}catch{}
      if(isReg){
        if(ex){setErr("Usuário já existe. Faça login.");setLoading(false);return;}
        const usr={username:u.trim(),pwHash:pw,createdAt:Date.now()};
        await window.storage.set(key,JSON.stringify(usr),true);
        await window.storage.set("rpg_sess",JSON.stringify({username:usr.username,pwHash:pw}));
        onLogin(usr);
      }else{
        if(!ex){setErr("Usuário não encontrado.");setLoading(false);return;}
        if(ex.pwHash!==pw){setErr("Senha incorreta.");setLoading(false);return;}
        await window.storage.set("rpg_sess",JSON.stringify({username:ex.username,pwHash:pw}));
        onLogin(ex);
      }
    }catch{setErr("Erro de armazenamento.");}
    setLoading(false);
  };
  return(
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:"370px"}}>
        <div style={{textAlign:"center",marginBottom:"28px"}}>
          <div style={{fontSize:"56px",marginBottom:"8px"}}>🎲</div>
          <h1 style={{color:"#f59e0b",fontFamily:"Georgia",fontSize:"28px",margin:0}}>RPG Companion</h1>
          <p style={{color:"#64748b",margin:"8px 0 0",fontSize:"14px"}}>Mesa Digital para Mestres e Jogadores</p>
        </div>
        <div style={{background:"#1e293b",borderRadius:"14px",padding:"24px",display:"grid",gap:"14px"}}>
          <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold",display:"block",marginBottom:"5px"}}>USUÁRIO</label>
            <input style={{...I,fontSize:"15px",padding:"10px 12px"}} value={u} onChange={e=>setU(e.target.value)} placeholder="Seu nome de usuário" autoComplete="username"/></div>
          <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold",display:"block",marginBottom:"5px"}}>SENHA</label>
            <input type="password" style={{...I,fontSize:"15px",padding:"10px 12px"}} value={p} onChange={e=>setP(e.target.value)} placeholder="••••••••" autoComplete="current-password" onKeyDown={e=>e.key==="Enter"&&handle(false)}/></div>
          {err&&<div style={{color:"#f87171",fontSize:"13px",padding:"8px 10px",background:"#1c0a0a",borderRadius:"6px"}}>⚠️ {err}</div>}
          <button onClick={()=>handle(false)} disabled={loading} style={{background:"#f59e0b",color:"#111",border:"none",borderRadius:"8px",padding:"12px",fontSize:"15px",fontWeight:"bold",cursor:loading?"wait":"pointer",boxShadow:"0 4px 14px #f59e0b44"}}>
            {loading?"Entrando...":"Entrar"}
          </button>
          <button onClick={()=>handle(true)} disabled={loading} style={{background:"transparent",color:"#60a5fa",border:"1px solid #1e40af",borderRadius:"8px",padding:"12px",fontSize:"15px",fontWeight:"bold",cursor:loading?"wait":"pointer"}}>
            Criar conta
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── LobbyCard ───────────────────────────────────────── */
function LobbyCard({lob,isMine,pw,onPwChange,onJoin,onDel}){
  return(
    <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:"10px",padding:"12px",marginBottom:"8px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
        <span style={{fontSize:"18px"}}>{lob.isPublic?"🌐":"🔒"}</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:"bold",fontSize:"15px"}}>{lob.name}</div>
          <div style={{fontSize:"11px",color:"#64748b"}}>por {lob.ownerId} · {lob.isPublic?"Público":"Privado"}{lob.pwHash?" · 🔑 senha":""}</div>
        </div>
        {isMine&&<button onClick={()=>onDel(lob.id)} style={{background:"transparent",color:"#ef4444",border:"1px solid #ef4444",borderRadius:"6px",padding:"3px 8px",cursor:"pointer",fontSize:"11px"}}>🗑️</button>}
      </div>
      {lob.pwHash&&<input style={{...SI,marginBottom:"8px"}} type="password" placeholder="Senha do lobby" value={pw||""} onChange={e=>onPwChange(lob.id,e.target.value)}/>}
      <button onClick={()=>onJoin(lob)} style={{background:"#1e3a5f",color:"#60a5fa",border:"1px solid #1e40af",borderRadius:"6px",padding:"7px",cursor:"pointer",fontSize:"13px",fontWeight:"bold",width:"100%"}}>Entrar →</button>
    </div>
  );
}

/* ── LobbyBrowser ────────────────────────────────────── */
function LobbyBrowser({user, chars, onEnterLobby, onLogout, onSaveChar, onDeleteChar}){
  const [lobbies,setLobbies]=useState([]); const [mine,setMine]=useState([]);
  const [showCreate,setShowCreate]=useState(false);
  const [lName,setLName]=useState(""); const [lPw,setLPw]=useState(""); const [lPub,setLPub]=useState(true);
  const [joinPw,setJoinPw]=useState({}); const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  
  // Novas variáveis para as Abas e Edição de Personagem
  const [tab, setTab] = useState("lobbies");
  const [showCE, setShowCE] = useState(false);
  const [editChar, setEditChar] = useState(null);
  const [delC, setDelC] = useState(null);
  
  const bc = v => v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#475569";

  const load=useCallback(async()=>{
    try{
      const r=await window.storage.list("rpg_lob:",true);
      if(r?.keys?.length){
        const all=(await Promise.all(r.keys.map(async k=>{try{const d=await window.storage.get(k,true);return d?JSON.parse(d.value):null;}catch{return null;}}))).filter(Boolean);
        setMine(all.filter(l=>l.ownerId===user.username));
        setLobbies(all.filter(l=>l.isPublic&&l.ownerId!==user.username));
      }else{setMine([]);setLobbies([]);}
    }catch{}
  },[user.username]);

  useEffect(()=>{load();const iv=setInterval(load,10000);return()=>clearInterval(iv);},[load]);

  const create=async()=>{
    if(!lName.trim()){setErr("Dê um nome ao lobby.");return;}
    setLoading(true);
    const id=mkId();
    const lob={id,name:lName.trim(),pwHash:lPw?hashPw(lPw):null,ownerId:user.username,isPublic:lPub,createdAt:Date.now()};
    try{await window.storage.set(`rpg_lob:${id}`,JSON.stringify(lob),true);setShowCreate(false);setLName("");setLPw("");setErr("");await load();onEnterLobby(lob);}
    catch{setErr("Erro ao criar.");}
    setLoading(false);
  };

  const join=async lob=>{
    const pw=joinPw[lob.id]||"";
    if(lob.pwHash){if(!pw){setErr(`Senha necessária para "${lob.name}".`);return;}if(hashPw(pw)!==lob.pwHash){setErr("Senha incorreta.");return;}}
    setErr(""); onEnterLobby(lob);
  };

  const del=async id=>{try{await window.storage.delete(`rpg_lob:${id}`,true);await load();}catch{}};
  const onPwChange=(id,v)=>setJoinPw(p=>({...p,[id]:v}));

  // Se estiver criando ou editando um char, mostra o CharEditor em tela cheia
  if(showCE) return(
    <div style={{background:"#0f172a",minHeight:"100vh",padding:"20px",fontFamily:"'Segoe UI',sans-serif"}}>
      <button onClick={()=>{setShowCE(false);setEditChar(null);}} style={{background:"transparent",color:"#64748b",border:"none",cursor:"pointer",marginBottom:"16px",fontSize:"14px"}}>← Voltar</button>
      <CharEditor char={editChar} owner={user.username} onSave={async c=>{await onSaveChar(c);setShowCE(false);setEditChar(null);}} onCancel={()=>{setShowCE(false);setEditChar(null);}}/>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#0f172a",color:"#e2e8f0",fontFamily:"'Segoe UI',sans-serif"}}>
      {/* Cabeçalho */}
      <div style={{background:"#1e293b",borderBottom:"2px solid #f59e0b",padding:"10px 16px",display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"20px"}}>🎲</span>
        <span style={{color:"#f59e0b",fontSize:"17px",fontWeight:"bold",fontFamily:"Georgia"}}>RPG Companion</span>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px"}}>
          <span style={{fontSize:"13px",color:"#94a3b8"}}>👤 {user.username}</span>
          <button onClick={onLogout} style={{background:"transparent",color:"#64748b",border:"none",cursor:"pointer",fontSize:"12px"}}>Sair</button>
        </div>
      </div>

      {/* Menu de Abas */}
      <div style={{display:"flex",background:"#1e293b",borderBottom:"1px solid #0f172a"}}>
        <button onClick={()=>setTab("lobbies")} style={{flex:1,padding:"12px",background:"none",border:"none",borderBottom:tab==="lobbies"?"3px solid #f59e0b":"3px solid transparent",color:tab==="lobbies"?"#f59e0b":"#64748b",cursor:"pointer",fontWeight:tab==="lobbies"?"bold":"normal",transition:"all .2s"}}>🌐 Lobbies</button>
        <button onClick={()=>setTab("chars")} style={{flex:1,padding:"12px",background:"none",border:"none",borderBottom:tab==="chars"?"3px solid #f59e0b":"3px solid transparent",color:tab==="chars"?"#f59e0b":"#64748b",cursor:"pointer",fontWeight:tab==="chars"?"bold":"normal",transition:"all .2s"}}>⚔️ Meus Personagens</button>
      </div>

      <div style={{padding:"16px",maxWidth:"560px",margin:"0 auto"}}>
        
        {/* ABA 1: LOBBIES (O Código Antigo) */}
        {tab === "lobbies" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <h2 style={{color:"#f59e0b",fontFamily:"Georgia",margin:0}}>Salas de Jogo</h2>
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={load} style={{background:"transparent",color:"#64748b",border:"1px solid #374151",borderRadius:"6px",padding:"6px 10px",cursor:"pointer",fontSize:"12px"}}>↻</button>
                <button onClick={()=>setShowCreate(s=>!s)} style={{background:"#f59e0b",color:"#111",border:"none",borderRadius:"8px",padding:"7px 14px",fontWeight:"bold",cursor:"pointer",fontSize:"13px"}}>+ Criar</button>
              </div>
            </div>
            
            {showCreate&&(
              <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",marginBottom:"16px",border:"1px solid #334155"}}>
                <h3 style={{color:"#f59e0b",margin:"0 0 12px",fontSize:"15px"}}>Novo Lobby</h3>
                <div style={{display:"grid",gap:"10px"}}>
                  <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold",display:"block",marginBottom:"4px"}}>NOME</label>
                    <input style={I} value={lName} onChange={e=>setLName(e.target.value)} placeholder="Ex: Aventura nas Terras do Norte"/></div>
                  <div><label style={{color:"#9ca3af",fontSize:"11px",fontWeight:"bold",display:"block",marginBottom:"4px"}}>SENHA (opcional)</label>
                    <input type="password" style={I} value={lPw} onChange={e=>setLPw(e.target.value)} placeholder="Deixe vazio para sem senha"/></div>
                  <label style={{display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",color:"#94a3b8",fontSize:"13px"}}>
                    <input type="checkbox" checked={lPub} onChange={e=>setLPub(e.target.checked)}/>
                    Lobby público (aparece na lista)
                  </label>
                  {err&&<div style={{color:"#f87171",fontSize:"13px"}}>{err}</div>}
                  <div style={{display:"flex",gap:"8px"}}>
                    <button onClick={create} disabled={loading} style={{flex:1,background:"#f59e0b",color:"#111",border:"none",borderRadius:"8px",padding:"10px",fontWeight:"bold",cursor:"pointer"}}>{loading?"Criando...":"Criar"}</button>
                    <button onClick={()=>{setShowCreate(false);setErr("");}} style={{flex:1,background:"#374151",color:"#e5e7eb",border:"none",borderRadius:"8px",padding:"10px",cursor:"pointer"}}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
            
            {err&&!showCreate&&<div style={{color:"#f87171",fontSize:"13px",padding:"8px 10px",background:"#1c0a0a",borderRadius:"6px",marginBottom:"12px"}}>⚠️ {err}</div>}
            
            {mine.length>0&&(
              <div style={{marginBottom:"16px"}}>
                <div style={{color:"#64748b",fontSize:"11px",fontWeight:"bold",marginBottom:"8px"}}>MEUS LOBBIES</div>
                {mine.map(l=><LobbyCard key={l.id} lob={l} isMine={true} pw={joinPw[l.id]} onPwChange={onPwChange} onJoin={join} onDel={del}/>)}
              </div>
            )}
            
            <div>
              <div style={{color:"#64748b",fontSize:"11px",fontWeight:"bold",marginBottom:"8px"}}>LOBBIES PÚBLICOS</div>
              {lobbies.length===0
                ?<div style={{textAlign:"center",padding:"40px",color:"#374151"}}><div style={{fontSize:"32px",marginBottom:"8px"}}>🔍</div><div>Nenhum lobby público.</div><div style={{fontSize:"12px",marginTop:"4px"}}>Crie um para começar!</div></div>
                :lobbies.map(l=><LobbyCard key={l.id} lob={l} isMine={false} pw={joinPw[l.id]} onPwChange={onPwChange} onJoin={join} onDel={del}/>)}
            </div>
          </div>
        )}

        {/* ABA 2: MEUS PERSONAGENS (A Nova Taverna) */}
        {tab === "chars" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <h2 style={{color:"#f59e0b",fontFamily:"Georgia",margin:0}}>Armaria</h2>
              <button onClick={()=>{setEditChar(null);setShowCE(true);}} style={{background:"#f59e0b",color:"#111",border:"none",borderRadius:"8px",padding:"7px 14px",fontWeight:"bold",cursor:"pointer",fontSize:"13px"}}>+ Novo Personagem</button>
            </div>
            
            {chars.length === 0 && (
              <div style={{textAlign:"center",padding:"40px",color:"#374151"}}>
                <div style={{fontSize:"40px",marginBottom:"8px"}}>⚔️</div>
                <div>Nenhum aventureiro criado.</div>
                <div style={{fontSize:"12px",marginTop:"4px"}}>Forje seu primeiro herói!</div>
              </div>
            )}
            
            {chars.map(c=>(
              <div key={c.id} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                {delC===c.id?(
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{color:"#f87171",flex:1}}>Deletar <strong>{c.name}</strong> permanentemente?</span>
                    <button onClick={()=>{onDeleteChar(c.id);setDelC(null);}} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:"6px",padding:"6px 12px",cursor:"pointer",fontWeight:"bold"}}>Sim</button>
                    <button onClick={()=>setDelC(null)} style={{background:"#374151",color:"#e2e8f0",border:"none",borderRadius:"6px",padding:"6px 12px",cursor:"pointer"}}>Não</button>
                  </div>
                ):(
                  <div style={{display:"flex",gap:"10px"}}>
                    <div style={{flex:1,minWidth:0}}>
                      {/* Título e Tags */}
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px",flexWrap:"wrap"}}>
                        <span style={{fontWeight:"bold",fontSize:"16px"}}>{c.name}</span>
                        <span style={{background:"#0f172a",borderRadius:"10px",padding:"1px 8px",fontSize:"11px",color:"#f59e0b",fontWeight:"bold"}}>Nv.{c.nivel}</span>
                        {c.classe&&<span style={{fontSize:"12px",color:"#94a3b8"}}>{c.classe}</span>}
                        {c.skills?.length>0&&<span style={{fontSize:"11px",color:"#a855f7",background:"#1e0a2e",borderRadius:"10px",padding:"1px 7px"}}>⚡ {c.skills.length}</span>}
                      </div>
                      
                      {/* Barras de HP e Vigor coloridas */}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"8px"}}>
                        <div>
                          <div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"2px"}}>❤️ {c.hp}/{c.hpMax}</div>
                          <div style={{background:"#0f172a",borderRadius:"4px",height:"5px"}}>
                            <div style={{background:c.hp/c.hpMax>.5?"#22c55e":c.hp/c.hpMax>.25?"#eab308":"#ef4444",width:`${Math.min(100,(c.hp/c.hpMax)*100)}%`,height:"100%",borderRadius:"4px"}}/>
                          </div>
                        </div>
                        {c.vigorMax>0&&<div>
                          <div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"2px"}}>⚡ {c.vigor}/{c.vigorMax}</div>
                          <div style={{background:"#0f172a",borderRadius:"4px",height:"5px"}}>
                            <div style={{background:"#3b82f6",width:`${Math.min(100,(c.vigor/c.vigorMax)*100)}%`,height:"100%",borderRadius:"4px"}}/>
                          </div>
                        </div>}
                      </div>
                      
                      {/* Grade de Atributos */}
                      <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                        {ATTRS.map(a=><span key={a.key} style={{background:"#0f172a",borderRadius:"4px",padding:"2px 5px",fontSize:"10px",border:"1px solid #1e2937",color:bc(c.bonuses[a.key]||0)}}>{a.short}: {(c.bonuses[a.key]||0)>=0?"+":" "}{c.bonuses[a.key]||0}</span>)}
                      </div>
                    </div>
                    
                    {/* Botões de Ação Empilhados (Padrão GameScreen) */}
                    <div style={{display:"flex",flexDirection:"column",gap:"6px",minWidth:"45px"}}>
                      <button onClick={()=>{setEditChar(c);setShowCE(true);}} style={{background:"#111827",color:"#94a3b8",border:"1px solid #374151",borderRadius:"6px",padding:"6px",cursor:"pointer",fontSize:"14px",flex:1}} title="Editar">✏️</button>
                      <button onClick={()=>setDelC(c.id)} style={{background:"#111827",color:"#ef4444",border:"1px solid #7f1d1d",borderRadius:"6px",padding:"6px",cursor:"pointer",fontSize:"14px",flex:1}} title="Deletar">🗑️</button>
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

/* ── RoleSelect ──────────────────────────────────────── */
function RoleSelect({user,lobby,chars,onJoin,onCreateChar,onBack}){
  const [role,setRole]=useState("jogador"); const [charId,setCharId]=useState(chars[0]?.id||"");
  const [err,setErr]=useState(""); const [members,setMembers]=useState([]);

  const loadM=useCallback(async()=>{
    try{
      const r=await window.storage.list(`rpg_mem:${lobby.id}:`,true);
      if(r?.keys?.length){
        const ms=(await Promise.all(r.keys.map(async k=>{try{const d=await window.storage.get(k,true);return d?JSON.parse(d.value):null;}catch{return null;}}))).filter(Boolean).filter(m=>Date.now()-m.ts<120000);
        setMembers(ms);
      }else setMembers([]);
    }catch{}
  },[lobby.id]);

  useEffect(()=>{loadM();const iv=setInterval(loadM,5000);return()=>clearInterval(iv);},[loadM]);
  const hasMaster=members.some(m=>m.role==="mestre");

  const join=async()=>{
    if(role==="mestre"&&hasMaster){setErr("Já existe um Mestre!");return;}
    if(role==="jogador"&&!charId){setErr("Selecione um personagem!");return;}
    const mem={username:user.username,role,charId:role==="jogador"?charId:null,lobbyId:lobby.id,ts:Date.now()};
    try{
      await window.storage.set(`rpg_mem:${lobby.id}:${user.username}`,JSON.stringify(mem),true);
      await window.storage.set("rpg_cur",JSON.stringify({username:user.username,lobbyId:lobby.id,role,charId:mem.charId}));
    }catch{}
    onJoin(mem);
  };

  const ROLES=[
    ["mestre","👑","Mestre","Narra e controla o mapa",hasMaster],
    ["jogador","⚔️","Jogador","Controla personagem",false],
    ["espectador","👁️","Espectador","Assiste a sessão",false],
  ];

  return(
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{width:"100%",maxWidth:"440px"}}>
        <button onClick={onBack} style={{background:"transparent",color:"#64748b",border:"none",cursor:"pointer",marginBottom:"14px",fontSize:"14px"}}>← Lobbies</button>
        <div style={{background:"#1e293b",borderRadius:"14px",padding:"20px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",paddingBottom:"14px",borderBottom:"1px solid #334155"}}>
            <span style={{fontSize:"24px"}}>🎲</span>
            <div><div style={{fontWeight:"bold",fontSize:"16px"}}>{lobby.name}</div><div style={{fontSize:"12px",color:"#64748b"}}>por {lobby.ownerId}</div></div>
          </div>
          {members.length>0&&(
            <div style={{marginBottom:"14px"}}>
              <div style={{color:"#64748b",fontSize:"11px",fontWeight:"bold",marginBottom:"6px"}}>NA SESSÃO</div>
              {members.map(m=>(
                <div key={m.username} style={{display:"flex",alignItems:"center",gap:"8px",padding:"4px 0"}}>
                  <span>{m.role==="mestre"?"👑":m.role==="espectador"?"👁️":"⚔️"}</span>
                  <span style={{fontSize:"13px"}}>{m.username}</span>
                  <span style={{fontSize:"11px",color:"#64748b",background:"#0f172a",borderRadius:"10px",padding:"1px 6px"}}>{m.role}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{marginBottom:"12px"}}>
            <div style={{color:"#64748b",fontSize:"11px",fontWeight:"bold",marginBottom:"8px"}}>ESCOLHER PAPEL</div>
            {ROLES.map(([r,ico,lbl,sub,dis])=>(
              <button key={r} onClick={()=>{if(!dis){setRole(r);setErr("");}}} style={{
                background:role===r?"#1e3a5f":"#111827",border:`2px solid ${role===r?"#3b82f6":dis?"#2d1a0e":"#374151"}`,
                borderRadius:"10px",padding:"10px 14px",cursor:dis?"not-allowed":"pointer",
                display:"flex",alignItems:"center",gap:"12px",width:"100%",marginBottom:"6px",opacity:dis&&role!==r?0.5:1,
              }}>
                <span style={{fontSize:"22px"}}>{ico}</span>
                <div style={{textAlign:"left"}}>
                  <div style={{color:role===r?"#60a5fa":"#e2e8f0",fontWeight:"bold",fontSize:"14px"}}>{lbl}{dis?" (ocupado)":""}</div>
                  <div style={{color:"#64748b",fontSize:"11px"}}>{sub}</div>
                </div>
              </button>
            ))}
          </div>
          {role==="jogador"&&(
            <div style={{marginBottom:"12px"}}>
              <div style={{color:"#64748b",fontSize:"11px",fontWeight:"bold",marginBottom:"6px"}}>PERSONAGEM</div>
              {chars.length>0?(
                <>
                  <select style={{...I,marginBottom:"8px"}} value={charId} onChange={e=>setCharId(e.target.value)}>
                    <option value="">— Selecione —</option>
                    {chars.map(c=><option key={c.id} value={c.id}>{c.name} ({c.classe||"?"} Nv.{c.nivel})</option>)}
                  </select>
                  <button onClick={onCreateChar} style={{background:"transparent",color:"#60a5fa",border:"1px dashed #1e40af",borderRadius:"8px",padding:"7px",width:"100%",cursor:"pointer",fontSize:"12px"}}>+ Criar novo personagem</button>
                </>
              ):<button onClick={onCreateChar} style={{background:"#1e3a5f",color:"#60a5fa",border:"1px solid #1e40af",borderRadius:"8px",padding:"10px",width:"100%",cursor:"pointer",fontSize:"14px",fontWeight:"bold"}}>⚔️ Criar personagem primeiro</button>}
            </div>
          )}
          {err&&<div style={{color:"#f87171",fontSize:"13px",padding:"8px",background:"#1c0a0a",borderRadius:"6px",marginBottom:"10px"}}>⚠️ {err}</div>}
          <button onClick={join} style={{background:"#f59e0b",color:"#111",border:"none",borderRadius:"10px",padding:"13px",width:"100%",fontSize:"16px",fontWeight:"bold",cursor:"pointer",boxShadow:"0 4px 14px #f59e0b44"}}>🎲 Entrar</button>
        </div>
      </div>
    </div>
  );
}

/* ── GameScreen ──────────────────────────────────────── */
function GameScreen({user,lobby,member,chars,onLeave,onSaveChar,onDeleteChar}){
  const isMestre=member.role==="mestre";
  const isEsp=member.role==="espectador";
  const activeChar=member.charId?chars.find(c=>c.id===member.charId):null;

  const TABS=isMestre
    ?[["dados","🎲"],["personagens","⚔️"],["mestre","🗺️"],["sessao","👥"]]
    :isEsp
    ?[["tela","🗺️"],["sessao","👥"]]
    :[["dados","🎲"],["personagens","⚔️"],["tela","🗺️"],["sessao","👥"]];
  const TLABELS={dados:"Dados",personagens:"Chars",mestre:"Mestre",sessao:"Sessão",habilidades:"Skills",tela:"Tela"};

  const [tab,setTab]=useState(TABS[0][0]);
  const [members,setMembers]=useState([]);
  const [editChar,setEditChar]=useState(null); const [showCE,setShowCE]=useState(false);
  const [delC,setDelC]=useState(null); const [showSkills,setShowSkills]=useState(false);

  const [num,setNum]=useState(1); const [dt,setDt]=useState(20); const [mb,setMb]=useState(0);
  const [atk,setAtk]=useState("none"); const [rolling,setRolling]=useState(false);
  const [dispN,setDispN]=useState(null); const [lastR,setLastR]=useState(null); const [hist,setHist]=useState([]);

  const canvasRef=useRef(null); const contRef=useRef(null);
  const drawing=useRef(false); const lastP=useRef(null);
  const lastSave=useRef(0); const canvasOk=useRef(false);
  const [tool,setTool]=useState("pen"); const [color,setColor]=useState("#ef4444");
  const [brush,setBrush]=useState(5); const fileRef=useRef(null);

// Guarda o histórico definitivo de todas as linhas já traçadas
  const [linhas, setLinhas] = useState([]);
  // Guarda a linha atual em tempo real enquanto o mestre arrasta o mouse (para não travar o React com excesso de renders)
  const linhaAtual = useRef(null);
  
  const linhasRef = useRef([]);
  useEffect(() => { linhasRef.current = linhas; }, [linhas]);

  
  // Image objects state
  const [images,setImages]=useState([]);
  const [selImg, setSelImg] = useState([]); // Agora é um Array (Grupo)
  const [selBox, setSelBox] = useState(null); // Guarda as dimensões do retângulo {x, y, w, h}
  const selStart = useRef(null); // Guarda onde o clique da seleção começou
  const imagesRef=useRef([]);
  useEffect(()=>{imagesRef.current=images;},[images]);

  // Load saved images on mount (master only)
  useEffect(()=>{
    if(!isMestre)return;
    (async()=>{
      try{
        const r=await window.storage.get(`rpg_cv_imgs:${lobby.id}`,true);
        if(r)setImages(JSON.parse(r.value));
      }catch{}
    })();
  },[isMestre,lobby.id]);

  // Persist images when changed (master only)
  useEffect(()=>{
    if(!isMestre)return;
    const t=setTimeout(async()=>{
      try{await window.storage.set(`rpg_cv_imgs:${lobby.id}`,JSON.stringify(images),true);}catch{}
    },1500);
    return()=>clearTimeout(t);
  },[images,isMestre,lobby.id]);

  // Composite canvas + images into JPEG for sync
  const getCompositeDataUrl=useCallback(async()=>{
    const cv=canvasRef.current;
    const tmp=document.createElement("canvas");
    tmp.width=cv.width;tmp.height=cv.height;
    const ctx=tmp.getContext("2d");

    // 1. Fundo sólido (já que o canvas agora é invisível)
    ctx.fillStyle="#111827";
    ctx.fillRect(0,0,tmp.width,tmp.height);

    const rect=cv.getBoundingClientRect();
    const sx=cv.width/rect.width,sy=cv.height/rect.height;

    // Função mágica para desenhar imagens por camada
    const drawImgs = async (isMap) => {
      const layerImgs = imagesRef.current.filter(i => isMap ? i.layer==="map" : i.layer!=="map");
      await Promise.all(layerImgs.map(img=>new Promise(resolve=>{
        const el=new Image();
        el.onload=()=>{ctx.drawImage(el,img.x*sx,img.y*sy,img.w*sx,img.h*sy);resolve();};
        el.onerror=resolve;
        el.src=img.dataUrl;
      })));
    };

    // 2. Desenha Mapas (Enviados para o Fundo)
    await drawImgs(true);
    // 3. Desenha os Traços (O Canvas do Mestre)
    ctx.drawImage(cv,0,0);
    // 4. Desenha Tokens (Na Frente)
    await drawImgs(false);

    return tmp.toDataURL("image/jpeg",0.6);
  },[]);

  useEffect(()=>{
    const ping=async()=>{try{const u={...member,ts:Date.now()};await window.storage.set(`rpg_mem:${lobby.id}:${user.username}`,JSON.stringify(u),true);}catch{}};
    ping();const iv=setInterval(ping,25000);return()=>clearInterval(iv);
  },[]);

  useEffect(()=>{
    const load=async()=>{
      try{
        const r=await window.storage.list(`rpg_mem:${lobby.id}:`,true);
        if(r?.keys?.length){
          const ms=(await Promise.all(r.keys.map(async k=>{try{const d=await window.storage.get(k,true);return d?JSON.parse(d.value):null;}catch{return null;}}))).filter(Boolean).filter(m=>Date.now()-m.ts<90000);
          setMembers(ms);
        }else setMembers([]);
      }catch{}
    };
    load();const iv=setInterval(load,6000);return()=>clearInterval(iv);
  },[lobby.id]);

  const redesenharVetores = (ctx) => {
    linhasRef.current.forEach(linha => {
      if(linha.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(linha.points[0].x, linha.points[0].y);
      for(let i = 1; i < linha.points.length; i++) {
        ctx.lineTo(linha.points[i].x, linha.points[i].y);
      }
      ctx.strokeStyle = linha.tool === "eraser" ? "#111827" : linha.color;
      ctx.lineWidth = linha.tool === "eraser" ? linha.brush * 5 : linha.brush;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    });
  };

  useEffect(() => {
    if ((tab !== "mestre" && tab !== "tela") || !contRef.current) return;
    canvasOk.current = false;
    let timeoutId = null;

    const ro = new ResizeObserver(entries => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        for (const e of entries) {
          const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
          if (w < 1 || h < 1) continue;
          const cv = canvasRef.current; if (!cv) continue;

          const dpr = window.devicePixelRatio || 1;
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(h * dpr);
          const ctx = cv.getContext("2d");
          
          ctx.imageSmoothingEnabled = false; 
          ctx.clearRect(0, 0, cv.width, cv.height);
          
          // Lemos diretamente da ponte de memória, livre de ilusões de escopo
          const tracados = linhasRef.current || [];
          
          tracados.forEach(linha => {
            if (!linha || !linha.points || linha.points.length < 2) return;
            ctx.beginPath();
            
            // Desenha o vetor escalado
            ctx.moveTo(linha.points[0].x * cv.width, linha.points[0].y * cv.height);
            for (let i = 1; i < linha.points.length; i++) {
              ctx.lineTo(linha.points[i].x * cv.width, linha.points[i].y * cv.height);
            }
            
            // ENSINA O REDESENHO A APAGAR TAMBÉM
            ctx.globalCompositeOperation = linha.tool === "eraser" ? "destination-out" : "source-over";
            
            ctx.strokeStyle = linha.tool === "eraser" ? "rgba(0,0,0,1)" : linha.color;
            ctx.lineWidth = linha.tool === "eraser" ? linha.brush * 5 : linha.brush;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.stroke();
            
            // Reseta para o padrão antes de desenhar a próxima linha do histórico
            ctx.globalCompositeOperation = "source-over";
          });

          canvasOk.current = true;
        }
      }, 150); 
    });

    ro.observe(contRef.current);
    
    return () => {
      ro.disconnect();
      clearTimeout(timeoutId);
    };
  }, [tab]);

// Escuta o evento de "Colar" (Ctrl+V) para invocar imagens diretamente na mesa
  useEffect(() => {
    // Apenas o mestre tem o poder de invocar imagens
    if (!isMestre) return;

    const handlePaste = (e) => {
      // Pega os itens da área de transferência
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        // Verifica se o que foi colado é uma imagem
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          const reader = new FileReader();
          
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              // Limita o tamanho inicial para não cobrir a tela inteira (ex: máx 300px)
              const max = 300;
              let w = img.width, h = img.height;
              if (w > max || h > max) {
                const ratio = Math.min(max / w, max / h);
                w *= ratio; h *= ratio;
              }

              // Cria a estrutura exata que o seu ImageObject espera
              const novaImagem = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 6), // ID único
                x: 50, y: 50, // Nasce no canto superior esquerdo
                w: Math.round(w), h: Math.round(h),
                dataUrl: event.target.result,
                layer: "token" // Nasce sempre na frente (o Mestre pode enviar pro fundo)
              };
              
              // Adiciona ao estado do React
              setImages(prev => [...prev, novaImagem]);
            };
            img.src = event.target.result;
          };
          // Transforma o arquivo colado na string base64 que o seu canvas usa
          reader.readAsDataURL(blob);
          
          break; // Para no primeiro arquivo de imagem encontrado para evitar bugs
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    
    // Limpa o evento quando o componente for desmontado para não acumular magias
    return () => window.removeEventListener("paste", handlePaste);
  }, [isMestre]);
  
  // Save composite (canvas + images) to storage
  useEffect(()=>{
    if(!isMestre)return;
    const iv=setInterval(async()=>{
      if(!canvasRef.current||!canvasOk.current)return;
      const now=Date.now();if(now-lastSave.current<3500)return;
      lastSave.current=now;
      try{
        const data=await getCompositeDataUrl();
        await window.storage.set(`rpg_cv:${lobby.id}`,JSON.stringify({data,ts:now}),true);
      }catch{}
    },4000);
    return()=>clearInterval(iv);
  },[isMestre,lobby.id,getCompositeDataUrl]);

  useEffect(()=>{
    if(isMestre||tab!=="tela")return;
    const load=async()=>{
      try{
        const r=await window.storage.get(`rpg_cv:${lobby.id}`,true);
        if(!r)return;
        const {data}=JSON.parse(r.value);
        const cv=canvasRef.current;if(!cv||!canvasOk.current)return;
        const img=new Image();
        img.onload=()=>{
          const ctx=cv.getContext("2d");
          ctx.fillStyle="#111827";
          ctx.fillRect(0,0,cv.width,cv.height);
  
          // Calcula a escala para não distorcer (efeito zoom)
          const scale = Math.min(cv.width / img.width, cv.height / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          const x = (cv.width - w) / 2;
          const y = (cv.height - h) / 2;
  
          ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
        };
        img.src=data;
      }catch{}
    };
    load();const iv=setInterval(load,4000);return()=>clearInterval(iv);
  },[isMestre,tab,lobby.id]);

  // 1. A Captura Vetorial (Agora guarda porcentagens matemáticas da tela)
  const getP = e => {
    const cv = canvasRef.current, r = cv.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return {
      absX: (s.clientX - r.left) * (cv.width / r.width),
      absY: (s.clientY - r.top) * (cv.height / r.height),
      relX: (s.clientX - r.left) / r.width, // Eixo X proporcional (0.0 a 1.0)
      relY: (s.clientY - r.top) / r.height  // Eixo Y proporcional (0.0 a 1.0)
    };
  };

  const onDown = e => {
    if (!isMestre) return;
    const p = getP(e);
    
    // MAGIA DE SELEÇÃO
    if (tool === "select") {
      // Se clicou no vazio (Fundo), começa a desenhar a caixa
      if (e.target === canvasRef.current || e.target === contRef.current) {
        setSelImg([]); // Limpa a seleção anterior
        selStart.current = p; // Marca a origem da caixa
        setSelBox({ x: p.absX, y: p.absY, w: 0, h: 0 });
      }
      return;
    }

    // MAGIA DE DESENHO (Inalterada)
    e.preventDefault();
    drawing.current = true;
    lastP.current = p;
    linhaAtual.current = { tool, color, brush, points: [{ x: p.relX, y: p.relY }] };
  };

  const onMove = e => {
    if (!isMestre) return;
    const p = getP(e);

    // O poder de desenhar o retângulo de seleção em tempo real
    if (tool === "select" && selBox && selStart.current) {
      const start = selStart.current;
      setSelBox({
        x: Math.min(start.absX, p.absX),
        y: Math.min(start.absY, p.absY),
        w: Math.abs(p.absX - start.absX),
        h: Math.abs(p.absY - start.absY)
      });
      return;
    }

    if (!drawing.current || tool === "select" || !linhaAtual.current) return;
    
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    linhaAtual.current.points.push({ x: p.relX, y: p.relY });

    ctx.beginPath();
    ctx.moveTo(lastP.current.absX, lastP.current.absY);
    ctx.lineTo(p.absX, p.absY);
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    ctx.lineWidth = tool === "eraser" ? brush * 5 : brush;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over"; 
    
    lastP.current = p;
  };
  
  const onUp = () => {
    // MAGIA DA CAPTURA: Soltou o mouse? Engole as imagens dentro da caixa!
    if (tool === "select" && selBox) {
       const capturados = imagesRef.current.filter(img => {
          // Checa colisão 2D entre cada imagem e a caixa azul
          return (
             img.x < selBox.x + selBox.w &&
             img.x + img.w > selBox.x &&
             img.y < selBox.y + selBox.h &&
             img.y + img.h > selBox.y
          );
       }).map(i => i.id); // Pega apenas os IDs

       if (capturados.length > 0) setSelImg(capturados);
       setSelBox(null);
       selStart.current = null;
    }

    if (drawing.current && linhaAtual.current) {
      setLinhas(prev => [...prev, linhaAtual.current]);
      linhaAtual.current = null;
    }
    drawing.current = false;
  };

  const clearCv = () => {
    const cv = canvasRef.current, ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    setImages([]); 
    setSelImg(null);
    setLinhas([]); // Zera a memória de vetores
  };

  // Load image as interactive object
  const loadImg=e=>{
    const f=e.target.files[0];if(!f)return;
    const fr=new FileReader();
    fr.onload=ev=>{
      const dataUrl=ev.target.result;
      const el=new Image();
      el.onload=()=>{
        const cv=canvasRef.current;
        const rect=cv.getBoundingClientRect();
        const maxW=rect.width*0.65,maxH=rect.height*0.65;
        const scale=Math.min(maxW/el.width,maxH/el.height,1);
        const w=el.width*scale,h=el.height*scale;
        const x=(rect.width-w)/2,y=(rect.height-h)/2;
        const id=mkId();
        setImages(p=>[...p,{id,dataUrl,x,y,w,h}]);
        setTool("select");
        setSelImg(id);
      };
      el.src=dataUrl;
    };
    fr.readAsDataURL(f);
    e.target.value="";
  };

  const doRoll=()=>{
    if(rolling)return;setRolling(true);let i=0;
    const iv=setInterval(()=>{
      setDispN(Math.floor(Math.random()*dt)+1);
      if(++i>=10){
        clearInterval(iv);
        const res=Array.from({length:num},()=>Math.floor(Math.random()*dt)+1);
        const sum=res.reduce((a,b)=>a+b,0);
        const ab=activeChar&&atk!=="none"?(activeChar.bonuses[atk]||0):0;
        const bpd=mb+ab,tb=bpd*num,total=sum+tb;
        const r={id:Date.now(),label:`${num}d${dt}`,res,mb,ab,bpd,tb,num,total,attrL:atk!=="none"?ATTRS.find(a=>a.key===atk)?.short:null,isCrit:num===1&&dt===20&&res[0]===20,isFail:num===1&&dt===20&&res[0]===1,time:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};
        setLastR(r);setDispN(total);setHist(p=>[r,...p.slice(0,14)]);setRolling(false);
      }
    },55);
  };

  const bpd=mb+(activeChar&&atk!=="none"?(activeChar.bonuses[atk]||0):0);
  const tb=bpd*num;
  const saveChar=async c=>{await onSaveChar(c);setShowCE(false);setEditChar(null);};

  const canvasPanelJSX =(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)"}}>
      {isMestre&&(
        <div style={{background:"#1e293b",padding:"8px 10px",display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid #334155"}}>
          {/* Tools */}
          {[["select","🖱️ Selecionar"],["pen","✏️ Caneta"],["eraser","⬜ Borracha"]].map(([t,l])=>(
            <button key={t} onClick={()=>{setTool(t);if(t!=="select")setSelImg([]);}}
              style={{background:tool===t?"#f59e0b":"#111827",color:tool===t?"#111":"#e2e8f0",border:"none",borderRadius:"6px",padding:"6px 10px",cursor:"pointer",fontSize:"12px",fontWeight:"bold"}}>
              {l}
            </button>
          ))}
          
          {/* Color palette (only for pen) */}
          {tool!=="select"&&tool!=="eraser"&&(
            <div style={{display:"flex",gap:"4px"}}>
              {PAL.map(cl=>(
                <button key={cl} onClick={()=>{setColor(cl);setTool("pen");}}
                  style={{width:"22px",height:"22px",background:cl,border:color===cl&&tool==="pen"?"3px solid white":"2px solid #334155",borderRadius:"50%",cursor:"pointer"}}/>
              ))}
            </div>
          )}
          
          {/* Brush size */}
          {tool!=="select"&&(
            <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
              <span style={{fontSize:"12px",color:"#64748b"}}>Tam:</span>
              <input type="range" min="2" max="30" value={brush} onChange={e=>setBrush(+e.target.value)} style={{width:"56px"}}/>
              <span style={{fontSize:"12px",color:"#64748b"}}>{brush}</span>
            </div>
          )}

          {/* Select mode hint */}
          {tool==="select"&&images.length===0&&(
            <span style={{fontSize:"12px",color:"#475569",fontStyle:"italic"}}>Adicione uma imagem para selecionar</span>
          )}
          {tool==="select"&&selImg.length>0&&(
            <span style={{fontSize:"12px",color:"#60a5fa"}}>✓ Seleção ativa — arraste para mover, handles para redimensionar</span>
          )}

          {/* 🪄 A NOVA BARRA CONTEXTUAL ENTRA AQUI 🪄 */}
          {selImg.length > 0 && (
            <div style={{display:"flex", gap:"8px", borderLeft:"2px solid #334155", paddingLeft:"8px", marginLeft:"4px"}}>
              <button 
                onClick={() => setImages(prev => prev.map(i => selImg.includes(i.id) ? { ...i, layer: "token" } : i))}
                style={{background:"#3b82f6", color:"white", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer", fontWeight:"bold", fontSize:"13px"}}
                title="Trazer para Frente (Tokens)">
                ⬆️ Frente
              </button>
              
              <button 
                onClick={() => setImages(prev => prev.map(i => selImg.includes(i.id) ? { ...i, layer: "map" } : i))}
                style={{background:"#f59e0b", color:"#111", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer", fontWeight:"bold", fontSize:"13px"}}
                title="Enviar para o Fundo (Mapas)">
                ⬇️ Fundo
              </button>

              <button 
                onClick={() => {
                  setImages(prev => prev.filter(i => !selImg.includes(i.id)));
                  setSelImg([]); // Limpa a seleção após deletar
                }}
                style={{background:"#ef4444", color:"white", border:"none", borderRadius:"6px", padding:"6px 12px", cursor:"pointer", fontWeight:"bold", fontSize:"13px"}}
                title="Deletar Seleção">
                🗑️ Excluir
              </button>
            </div>
          )}

          <div style={{marginLeft:"auto",display:"flex",gap:"5px"}}>
            <button onClick={()=>fileRef.current?.click()} style={{background:"#111827",color:"#e2e8f0",border:"1px solid #374151",borderRadius:"6px",padding:"6px 10px",cursor:"pointer",fontSize:"12px"}}>🖼️ Imagem</button>
            <button onClick={clearCv} style={{background:"#111827",color:"#ef4444",border:"1px solid #ef4444",borderRadius:"6px",padding:"6px 10px",cursor:"pointer",fontSize:"12px"}}>🗑️ Limpar</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={loadImg}/>
        </div>
      )}
      {!isMestre&&(
        <div style={{background:"#1e293b",padding:"8px 12px",display:"flex",alignItems:"center",gap:"8px",borderBottom:"1px solid #334155"}}>
          <span style={{fontSize:"13px",color:"#94a3b8"}}>🗺️ Tela do Mestre — somente leitura, atualiza a cada 4s</span>
          <div style={{marginLeft:"auto",width:"8px",height:"8px",background:"#22c55e",borderRadius:"50%"}}/>
        </div>
      )}
      {/* Canvas container - Sanduíche de Camadas */}
      <div ref={contRef} 
        style={{flex:1,overflow:"hidden",background:"#111827",position:"relative", touchAction: "none"}}
        // 👇 MOVEMOS OS EVENTOS PARA O CONTAINER PARA PEGAR A SELEÇÃO NO FUNDO
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      >
        
        {/* CAMADA 1: MAPAS */}
        {isMestre&&(
          <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:1}}>
            {images.filter(i=>i.layer==="map").map(img=>(
              <ImageObject key={img.id} img={img} 
                selected={selImg.includes(img.id)} 
                canSelect={tool==="select"}
                onSelect={()=>{
                    // Se clicar num que não está selecionado, ele vira o único. Se já está, ignora.
                    if(!selImg.includes(img.id)) setSelImg([img.id]);
                }}
                onUpdate={upd=>setImages(p=>p.map(i=>i.id===img.id?upd:i))}
                onDelete={()=>{
                    // Deleta TODO o grupo se ele fizer parte
                    if(selImg.includes(img.id)) {
                       setImages(p=>p.filter(i=>!selImg.includes(i.id)));
                       setSelImg([]);
                    } else {
                       setImages(p=>p.filter(i=>i.id!==img.id));
                    }
                }}
                onToggleLayer={()=>{
                    // Alterna TODO o grupo
                    const tLayer = img.layer === "map" ? "token" : "map";
                    if(selImg.includes(img.id)) {
                       setImages(p=>p.map(i=>selImg.includes(i.id)?{...i, layer: tLayer}:i));
                    } else {
                       setImages(p=>p.map(i=>i.id===img.id?{...i, layer: tLayer}:i));
                    }
                }}
                onMoveGroup={(dx, dy)=>{
                    // Move TODO o grupo arrastando um só!
                    if(selImg.includes(img.id)) {
                       setImages(p=>p.map(i=>selImg.includes(i.id)?{...i, x: i.x+dx, y: i.y+dy}:i));
                    } else {
                       setImages(p=>p.map(i=>i.id===img.id?{...i, x: i.x+dx, y: i.y+dy}:i));
                    }
                }}
              />
            ))}
          </div>
        )}

        {/* CAMADA 2: O CANETA/CANVAS */}
        <canvas ref={canvasRef}
          style={{
            width:"100%", height:"100%", display:"block", position:"relative", zIndex:2,
            cursor:isMestre?(tool==="select"?"default":tool==="eraser"?"cell":"crosshair"):"default",
            pointerEvents: isMestre && tool === "select" ? "none" : "auto" 
          }}
          // O canvas em si não precisa mais dos eventos no HTML, o container cuidará de tudo!
        />
          
        {/* CAMADA 3: TOKENS */}
        {isMestre&&(
          <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:3}}>
            {images.filter(i=>(i.layer||"token")!=="map").map(img=>(
              <ImageObject key={img.id} img={img} 
                selected={selImg.includes(img.id)} 
                canSelect={tool==="select"}
                onSelect={()=>{
                    if(!selImg.includes(img.id)) setSelImg([img.id]);
                }}
                onUpdate={upd=>setImages(p=>p.map(i=>i.id===img.id?upd:i))}
                onDelete={()=>{
                    if(selImg.includes(img.id)) {
                       setImages(p=>p.filter(i=>!selImg.includes(i.id)));
                       setSelImg([]);
                    } else {
                       setImages(p=>p.filter(i=>i.id!==img.id));
                    }
                }}
                onToggleLayer={()=>{
                    const tLayer = img.layer === "map" ? "token" : "map";
                    if(selImg.includes(img.id)) {
                       setImages(p=>p.map(i=>selImg.includes(i.id)?{...i, layer: tLayer}:i));
                    } else {
                       setImages(p=>p.map(i=>i.id===img.id?{...i, layer: tLayer}:i));
                    }
                }}
                onMoveGroup={(dx, dy)=>{
                    if(selImg.includes(img.id)) {
                       setImages(p=>p.map(i=>selImg.includes(i.id)?{...i, x: i.x+dx, y: i.y+dy}:i));
                    } else {
                       setImages(p=>p.map(i=>i.id===img.id?{...i, x: i.x+dx, y: i.y+dy}:i));
                    }
                }}
              />
            ))}
          </div>
        )}

        {/* CAMADA 4: A CAIXA VISUAL DE SELEÇÃO MÚLTIPLA */}
        {isMestre && tool === "select" && selBox && (
          <div style={{
             position: "absolute",
             left: selBox.x, top: selBox.y, width: selBox.w, height: selBox.h,
             backgroundColor: "rgba(59, 130, 246, 0.2)",
             border: "1px solid #3b82f6",
             pointerEvents: "none", zIndex: 10
          }} />
        )}
      </div>
    </div>
  );

  if(showCE) return(
    <div style={{background:"#0f172a",minHeight:"100vh",padding:"20px",fontFamily:"'Segoe UI',sans-serif"}}>
      <button onClick={()=>{setShowCE(false);setEditChar(null);}} style={{background:"transparent",color:"#64748b",border:"none",cursor:"pointer",marginBottom:"16px",fontSize:"14px"}}>← Voltar</button>
      <CharEditor char={editChar} owner={user.username} onSave={saveChar} onCancel={()=>{setShowCE(false);setEditChar(null);}}/>
    </div>
  );

  return(
    <div style={{background:"#0f172a",minHeight:"100vh",color:"#e2e8f0",fontFamily:"'Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>
      <div style={{background:"#1e293b",borderBottom:"2px solid #f59e0b",padding:"8px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"20px"}}>🎲</span>
        <span style={{color:"#f59e0b",fontSize:"16px",fontWeight:"bold",fontFamily:"Georgia",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"130px"}}>{lobby.name}</span>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px"}}>
          {isMestre?<span style={{background:"#422006",border:"1px solid #f59e0b",borderRadius:"20px",padding:"2px 8px",fontSize:"11px",color:"#f59e0b",fontWeight:"bold"}}>👑 Mestre</span>
            :isEsp?<span style={{background:"#0f172a",border:"1px solid #64748b",borderRadius:"20px",padding:"2px 8px",fontSize:"11px",color:"#94a3b8"}}>👁️ Espectador</span>
            :<span style={{background:"#0f172a",border:"1px solid #3b82f6",borderRadius:"20px",padding:"2px 8px",fontSize:"11px",color:"#60a5fa"}}>⚔️ {activeChar?.name||user.username}</span>}
          <button onClick={onLeave} style={{background:"transparent",color:"#64748b",border:"none",cursor:"pointer",fontSize:"12px"}}>Sair</button>
        </div>
      </div>

      <div style={{display:"flex",background:"#1e293b",borderBottom:"1px solid #0f172a"}}>
        {TABS.map(([id,ico])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"9px 2px",background:"none",border:"none",borderBottom:tab===id?"3px solid #f59e0b":"3px solid transparent",color:tab===id?"#f59e0b":"#64748b",cursor:"pointer",fontSize:"11px",transition:"all .2s"}}>
            <div style={{fontSize:"16px"}}>{ico}</div>
            <div style={{fontWeight:tab===id?"bold":"normal"}}>{TLABELS[id]}</div>
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:(tab==="mestre"||tab==="tela")?"hidden":"auto",padding:(tab==="mestre"||tab==="tela")?"0":"14px",display:(tab==="mestre"||tab==="tela")?"flex":"block",flexDirection:"column"}}>

        {tab==="dados"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"12px",maxWidth:"480px",margin:"0 auto"}}>
            {activeChar&&(
              <div style={{background:"#1e293b",borderRadius:"10px",padding:"12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",flexWrap:"wrap"}}>
                  <span style={{fontWeight:"bold",fontSize:"15px"}}>{activeChar.name}</span>
                  <span style={{background:"#0f172a",borderRadius:"10px",padding:"1px 8px",fontSize:"11px",color:"#f59e0b"}}>Nv.{activeChar.nivel}</span>
                  {activeChar.classe&&<span style={{fontSize:"12px",color:"#94a3b8"}}>{activeChar.classe}</span>}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"6px"}}>
                  <div><div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"2px"}}>❤️ {activeChar.hp}/{activeChar.hpMax}</div><div style={{background:"#0f172a",borderRadius:"4px",height:"5px"}}><div style={{background:activeChar.hp/activeChar.hpMax>.5?"#22c55e":activeChar.hp/activeChar.hpMax>.25?"#eab308":"#ef4444",width:`${Math.min(100,(activeChar.hp/activeChar.hpMax)*100)}%`,height:"100%",borderRadius:"4px"}}/></div></div>
                  {activeChar.vigorMax>0&&<div><div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"2px"}}>⚡ {activeChar.vigor}/{activeChar.vigorMax}</div><div style={{background:"#0f172a",borderRadius:"4px",height:"5px"}}><div style={{background:"#3b82f6",width:`${Math.min(100,(activeChar.vigor/activeChar.vigorMax)*100)}%`,height:"100%",borderRadius:"4px"}}/></div></div>}
                </div>
                <div style={{display:"flex",gap:"3px",flexWrap:"wrap"}}>
                  {ATTRS.map(a=><span key={a.key} style={{background:"#0f172a",borderRadius:"4px",padding:"2px 5px",fontSize:"10px",color:bc(activeChar.bonuses[a.key]||0)}}>{a.short}: {(activeChar.bonuses[a.key]||0)>=0?"+":" "}{activeChar.bonuses[a.key]||0}</span>)}
                </div>
              </div>
            )}
            <div style={{background:"#1e293b",borderRadius:"10px",padding:"12px"}}>
              <label style={{color:"#64748b",fontSize:"11px",fontWeight:"bold"}}>TIPO DE DADO</label>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"8px"}}>
                {DICE.map(d=><button key={d} onClick={()=>setDt(d)} style={{background:dt===d?"#f59e0b":"#111827",color:dt===d?"#111":"#e2e8f0",border:`2px solid ${dt===d?"#f59e0b":"#374151"}`,borderRadius:"8px",padding:"7px 10px",cursor:"pointer",fontWeight:"bold",fontSize:"13px",minWidth:"44px",transition:"all .15s"}}>d{d}</button>)}
              </div>
            </div>
            <div style={{background:"#1e293b",borderRadius:"10px",padding:"12px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
              <div>
                <label style={{color:"#64748b",fontSize:"11px",fontWeight:"bold"}}>Nº DADOS</label>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"6px"}}>
                  <button onClick={()=>setNum(n=>Math.max(1,n-1))} style={{background:"#111827",border:"1px solid #374151",borderRadius:"6px",color:"#e2e8f0",width:"30px",height:"30px",cursor:"pointer",fontSize:"16px"}}>−</button>
                  <span style={{fontSize:"20px",fontWeight:"bold",minWidth:"24px",textAlign:"center"}}>{num}</span>
                  <button onClick={()=>setNum(n=>Math.min(20,n+1))} style={{background:"#111827",border:"1px solid #374151",borderRadius:"6px",color:"#e2e8f0",width:"30px",height:"30px",cursor:"pointer",fontSize:"16px"}}>+</button>
                </div>
              </div>
              <div>
                <label style={{color:"#64748b",fontSize:"11px",fontWeight:"bold"}}>BÔNUS/DADO</label>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"6px"}}>
                  <button onClick={()=>setMb(n=>n-1)} style={{background:"#111827",border:"1px solid #374151",borderRadius:"6px",color:"#e2e8f0",width:"30px",height:"30px",cursor:"pointer",fontSize:"16px"}}>−</button>
                  <span style={{fontSize:"18px",fontWeight:"bold",minWidth:"30px",textAlign:"center",color:bc(mb)}}>{mb>=0?"+":" "}{mb}</span>
                  <button onClick={()=>setMb(n=>n+1)} style={{background:"#111827",border:"1px solid #374151",borderRadius:"6px",color:"#e2e8f0",width:"30px",height:"30px",cursor:"pointer",fontSize:"16px"}}>+</button>
                </div>
              </div>
            </div>
            {activeChar&&(
              <div style={{background:"#1e293b",borderRadius:"10px",padding:"12px"}}>
                <label style={{color:"#64748b",fontSize:"11px",fontWeight:"bold"}}>ATRIBUTO (bônus/dado)</label>
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"8px"}}>
                  <button onClick={()=>setAtk("none")} style={{background:atk==="none"?"#f59e0b":"#111827",color:atk==="none"?"#111":"#e2e8f0",border:`1px solid ${atk==="none"?"#f59e0b":"#374151"}`,borderRadius:"6px",padding:"4px 10px",cursor:"pointer",fontSize:"12px"}}>Nenhum</button>
                  {ATTRS.map(a=>{const bv=activeChar.bonuses[a.key]||0;return(
                    <button key={a.key} onClick={()=>setAtk(a.key)} style={{background:atk===a.key?"#f59e0b":"#111827",color:atk===a.key?"#111":"#e2e8f0",border:`1px solid ${atk===a.key?"#f59e0b":"#374151"}`,borderRadius:"6px",padding:"4px 7px",cursor:"pointer",fontSize:"11px",display:"flex",gap:"3px",alignItems:"center"}}>
                      {a.short}<span style={{fontWeight:"bold",color:atk===a.key?"#333":bc(bv)}}>{bv>=0?"+":""}{bv}</span>
                    </button>
                  );})}
                </div>
              </div>
            )}
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",textAlign:"center"}}>
              <div style={{fontSize:"12px",color:"#64748b",marginBottom:"2px"}}>
                {num}d{dt}{bpd!==0&&<span style={{color:bpd>=0?"#4ade80":"#f87171"}}> ({bpd>=0?"+":""}{bpd} × {num} = {tb>=0?"+":""}{tb})</span>}
              </div>
              <div style={{fontSize:dispN!==null&&String(dispN).length>3?"50px":"68px",fontWeight:"bold",fontFamily:"Georgia",minHeight:"84px",display:"flex",alignItems:"center",justifyContent:"center",color:lastR?.isCrit?"#fbbf24":lastR?.isFail?"#ef4444":"#f1f5f9",textShadow:lastR?.isCrit?"0 0 24px #fbbf24":"none"}}>
                {dispN!==null?dispN:"—"}
              </div>
              {lastR&&!rolling&&(
                <div style={{fontSize:"12px",color:"#64748b",marginBottom:"10px"}}>
                  {lastR.isCrit&&<div style={{color:"#fbbf24",fontWeight:"bold"}}>⭐ CRÍTICO! ⭐</div>}
                  {lastR.isFail&&<div style={{color:"#ef4444",fontWeight:"bold"}}>💀 FALHA CRÍTICA!</div>}
                  <div>[{lastR.res.join(", ")}]{lastR.bpd!==0&&` +(${lastR.bpd}×${lastR.num}=${lastR.tb})`}</div>
                </div>
              )}
              <button onClick={doRoll} disabled={rolling} style={{background:rolling?"#374151":"#f59e0b",color:rolling?"#64748b":"#111",border:"none",borderRadius:"10px",padding:"12px",fontSize:"17px",fontWeight:"bold",cursor:rolling?"not-allowed":"pointer",width:"100%",boxShadow:rolling?"none":"0 4px 14px #f59e0b55"}}>
                {rolling?"🎲 Rolando...":"🎲 Rolar!"}
              </button>
            </div>
            {activeChar?.skills?.length>0&&(
              <div style={{background:"#1e293b",borderRadius:"10px",padding:"12px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={()=>setShowSkills(s=>!s)}>
                  <span style={{color:"#a855f7",fontSize:"13px",fontWeight:"bold"}}>⚡ Habilidades</span>
                  <span style={{color:"#64748b",fontSize:"12px"}}>{showSkills?"▲":"▼"} ({activeChar.skills.length})</span>
                </div>
                {showSkills&&<div style={{marginTop:"10px"}}><SkillPanel char={activeChar}/></div>}
              </div>
            )}
            {hist.length>0&&(
              <div style={{background:"#1e293b",borderRadius:"10px",padding:"12px"}}>
                <div style={{color:"#64748b",fontSize:"11px",fontWeight:"bold",marginBottom:"6px"}}>HISTÓRICO</div>
                {hist.map((r,i)=>(
                  <div key={r.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"4px 6px",borderRadius:"6px",background:i===0?"#111827":"transparent",marginBottom:"2px",opacity:Math.max(.4,1-i*.06)}}>
                    <span style={{fontSize:"11px",color:"#475569",minWidth:"34px"}}>{r.time}</span>
                    <span style={{fontSize:"12px",color:"#94a3b8"}}>{r.label}</span>
                    {r.attrL&&<span style={{fontSize:"11px",color:"#60a5fa"}}>({r.attrL})</span>}
                    {r.bpd!==0&&<span style={{fontSize:"11px",color:"#64748b"}}>{r.bpd>=0?"+":""}{r.bpd}×{r.num}</span>}
                    <span style={{marginLeft:"auto",fontWeight:"bold",fontSize:"16px",color:r.isCrit?"#fbbf24":r.isFail?"#ef4444":"#f1f5f9"}}>{r.total}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==="habilidades"&&<div style={{maxWidth:"500px",margin:"0 auto"}}><h2 style={{color:"#f59e0b",fontFamily:"Georgia",margin:"0 0 14px"}}>⚡ Habilidades</h2><SkillPanel char={activeChar}/></div>}

        {tab==="personagens"&&(
          <div style={{maxWidth:"560px",margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
              <h2 style={{color:"#f59e0b",fontFamily:"Georgia",margin:0}}>Personagens</h2>
              {!isMestre&&<button onClick={()=>{setEditChar(null);setShowCE(true);}} style={{background:"#f59e0b",color:"#111",border:"none",borderRadius:"8px",padding:"7px 14px",fontWeight:"bold",cursor:"pointer"}}>+ Novo</button>}
            </div>
            {chars.length===0&&<div style={{textAlign:"center",padding:"40px",color:"#374151"}}><div style={{fontSize:"40px"}}>⚔️</div><div>Nenhum personagem.</div></div>}
            {chars.map(c=>(
              <div key={c.id} style={{background:"#1e293b",border:`2px solid ${member.charId===c.id?"#3b82f6":"#334155"}`,borderRadius:"12px",padding:"14px",marginBottom:"10px"}}>
                {delC===c.id?(
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{color:"#f87171",flex:1}}>Deletar <strong>{c.name}</strong>?</span>
                    <button onClick={()=>{onDeleteChar(c.id);setDelC(null);}} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:"6px",padding:"6px 12px",cursor:"pointer",fontWeight:"bold"}}>Sim</button>
                    <button onClick={()=>setDelC(null)} style={{background:"#374151",color:"#e2e8f0",border:"none",borderRadius:"6px",padding:"6px 12px",cursor:"pointer"}}>Não</button>
                  </div>
                ):(
                  <div style={{display:"flex",gap:"10px"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px",flexWrap:"wrap"}}>
                        <span style={{fontWeight:"bold",fontSize:"15px"}}>{c.name}</span>
                        <span style={{background:"#0f172a",borderRadius:"10px",padding:"1px 8px",fontSize:"11px",color:"#f59e0b"}}>Nv.{c.nivel}</span>
                        {c.classe&&<span style={{fontSize:"12px",color:"#94a3b8"}}>{c.classe}</span>}
                        {c.skills?.length>0&&<span style={{fontSize:"11px",color:"#a855f7",background:"#1e0a2e",borderRadius:"10px",padding:"1px 7px"}}>⚡{c.skills.length}</span>}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"6px"}}>
                        <div><div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"2px"}}>❤️ {c.hp}/{c.hpMax}</div><div style={{background:"#0f172a",borderRadius:"4px",height:"5px"}}><div style={{background:c.hp/c.hpMax>.5?"#22c55e":c.hp/c.hpMax>.25?"#eab308":"#ef4444",width:`${Math.min(100,(c.hp/c.hpMax)*100)}%`,height:"100%",borderRadius:"4px"}}/></div></div>
                        {c.vigorMax>0&&<div><div style={{fontSize:"11px",color:"#94a3b8",marginBottom:"2px"}}>⚡ {c.vigor}/{c.vigorMax}</div><div style={{background:"#0f172a",borderRadius:"4px",height:"5px"}}><div style={{background:"#3b82f6",width:`${Math.min(100,(c.vigor/c.vigorMax)*100)}%`,height:"100%",borderRadius:"4px"}}/></div></div>}
                      </div>
                      <div style={{display:"flex",gap:"3px",flexWrap:"wrap"}}>
                        {ATTRS.map(a=><span key={a.key} style={{background:"#0f172a",borderRadius:"4px",padding:"2px 5px",fontSize:"10px",color:bc(c.bonuses[a.key]||0)}}>{a.short}: {(c.bonuses[a.key]||0)>=0?"+":" "}{c.bonuses[a.key]||0}</span>)}
                      </div>
                    </div>
                    {!isMestre&&c.owner===user.username&&(
                      <div style={{display:"flex",flexDirection:"column",gap:"5px",minWidth:"70px"}}>
                        <button onClick={()=>{setEditChar(c);setShowCE(true);}} style={{background:"#111827",color:"#94a3b8",border:"1px solid #374151",borderRadius:"6px",padding:"5px 8px",cursor:"pointer",fontSize:"12px"}}>✏️</button>
                        <button onClick={()=>setDelC(c.id)} style={{background:"#111827",color:"#ef4444",border:"1px solid #ef4444",borderRadius:"6px",padding:"5px 8px",cursor:"pointer",fontSize:"12px"}}>🗑️</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {(tab==="mestre"||tab==="tela")&&canvasPanelJSX}

        {tab==="sessao"&&(
          <div style={{maxWidth:"460px",margin:"0 auto"}}>
            <h2 style={{color:"#f59e0b",fontFamily:"Georgia",margin:"0 0 14px"}}>👥 {lobby.name}</h2>
            <div style={{background:"#1e293b",borderRadius:"12px",padding:"14px",marginBottom:"14px"}}>
              <div style={{color:"#64748b",fontSize:"11px",fontWeight:"bold",marginBottom:"10px"}}>PARTICIPANTES ({members.length})</div>
              {members.length===0&&<div style={{color:"#374151",fontSize:"13px",textAlign:"center",padding:"16px"}}>Ninguém mais na sessão.</div>}
              {members.map(m=>(
                <div key={m.username} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px",background:"#0f172a",borderRadius:"8px",marginBottom:"6px"}}>
                  <span style={{fontSize:"18px"}}>{m.role==="mestre"?"👑":m.role==="espectador"?"👁️":"⚔️"}</span>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold",fontSize:"14px"}}>{m.username}{m.username===user.username?" (você)":""}</div>
                    <div style={{fontSize:"11px",color:"#64748b",textTransform:"capitalize"}}>{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onLeave} style={{background:"#1c0a0a",color:"#ef4444",border:"1px solid #ef4444",borderRadius:"8px",padding:"10px",cursor:"pointer",fontWeight:"bold",width:"100%"}}>🚪 Sair do Lobby</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── App ─────────────────────────────────────────────── */
export default function App(){
  const [screen,setScreen]=useState("loading");
  const [user,setUser]=useState(null);
  const [lobby,setLobby]=useState(null);
  const [member,setMember]=useState(null);
  const [chars,setChars]=useState([]);
  const [creatingChar,setCreatingChar]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const s=await window.storage.get("rpg_sess");
        if(s){
          const {username,pwHash}=JSON.parse(s.value);
          try{
            const ur=await window.storage.get(`rpg_user:${username.toLowerCase()}`,true);
            if(ur){
              const u=JSON.parse(ur.value);
              if(u.pwHash===pwHash){
                setUser(u);await loadChars(u.username);
                try{
                  const cr=await window.storage.get("rpg_cur");
                  if(cr){const cs=JSON.parse(cr.value);const lr=await window.storage.get(`rpg_lob:${cs.lobbyId}`,true);if(lr){setLobby(JSON.parse(lr.value));setMember(cs);setScreen("game");return;}}
                }catch{}
                setScreen("lobbies");return;
              }
            }
          }catch{}
        }
      }catch{}
      setScreen("login");
    })();
  },[]);

  const loadChars=async uname=>{
    try{
      const r=await window.storage.list(`rpg_char:${uname}:`,true);
      if(r?.keys?.length){
        const loaded=(await Promise.all(r.keys.map(async k=>{try{const d=await window.storage.get(k,true);return d?JSON.parse(d.value):null;}catch{return null;}}))).filter(Boolean);
        setChars(loaded);
      }else setChars([]);
    }catch{setChars([]);}
  };

  const saveChar=async c=>{
    const ch={...c,owner:user.username};
    setChars(p=>p.find(x=>x.id===ch.id)?p.map(x=>x.id===ch.id?ch:x):[...p,ch]);
    try{await window.storage.set(`rpg_char:${user.username}:${ch.id}`,JSON.stringify(ch),true);}catch{}
  };
  const deleteChar=async id=>{
    setChars(p=>p.filter(c=>c.id!==id));
    try{await window.storage.delete(`rpg_char:${user.username}:${id}`,true);}catch{}
  };
  const logout=async()=>{
    try{await window.storage.delete("rpg_sess");}catch{}
    if(member){try{await window.storage.delete(`rpg_mem:${lobby.id}:${user.username}`,true);await window.storage.delete("rpg_cur");}catch{}}
    setUser(null);setLobby(null);setMember(null);setChars([]);setScreen("login");
  };

  if(screen==="loading") return <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",color:"#f59e0b",fontSize:"40px"}}>🎲</div>;

  if(creatingChar) return(
    <div style={{background:"#0f172a",minHeight:"100vh",padding:"20px",fontFamily:"'Segoe UI',sans-serif"}}>
      <button onClick={()=>setCreatingChar(false)} style={{background:"transparent",color:"#64748b",border:"none",cursor:"pointer",marginBottom:"16px",fontSize:"14px"}}>← Voltar</button>
      <CharEditor char={null} owner={user?.username} onSave={async c=>{await saveChar(c);setCreatingChar(false);}} onCancel={()=>setCreatingChar(false)}/>
    </div>
  );

  if(screen==="login") return <LoginScreen onLogin={async u=>{setUser(u);await loadChars(u.username);setScreen("lobbies");}}/>;
  if(screen==="lobbies") return <LobbyBrowser user={user} chars={chars} onEnterLobby={l=>{setLobby(l);setScreen("role");}} onLogout={logout} onSaveChar={saveChar} onDeleteChar={deleteChar}/>;
  if(screen==="role") return <RoleSelect user={user} lobby={lobby} chars={chars} onJoin={m=>{setMember(m);setScreen("game");}} onCreateChar={()=>setCreatingChar(true)} onBack={()=>setScreen("lobbies")}/>;
  if(screen==="game") return <GameScreen user={user} lobby={lobby} member={member} chars={chars} onLeave={async()=>{try{await window.storage.delete(`rpg_mem:${lobby.id}:${user.username}`,true);await window.storage.delete("rpg_cur");}catch{}setMember(null);setScreen("lobbies");}} onSaveChar={saveChar} onDeleteChar={deleteChar}/>;
  return null;
}
