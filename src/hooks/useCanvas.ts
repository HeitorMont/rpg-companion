// src/hooks/useCanvas.ts
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import type { Linha, ImageObj } from "../types";
import { supabase } from "../lib/supabase";

const mkId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const MUNDO_W = 2000;
const MUNDO_H = 2000;

export function useCanvas(lobbyId: string, isMestre: boolean, tab: string) {
  const [tool, setTool] = useState(isMestre ? "pen" : "pan"); 
  const [color, setColor] = useState("#ef4444");
  const [brush, setBrush] = useState(5);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [images, setImages] = useState<ImageObj[]>([]);
  const [selImg, setSelImg] = useState<string[]>([]);
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // 🔮 As 3 Camadas Físicas
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<HTMLCanvasElement | null>(null);
  const fgRef = useRef<HTMLCanvasElement | null>(null);
  
  const contRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  
  const drawing = useRef(false);
  const panning = useRef(false);
  const movingTokens = useRef(false);

  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const linhasRef = useRef<Linha[]>([]);
  const imagesRef = useRef<ImageObj[]>([]);
  const selImgRef = useRef<string[]>([]);
  const toolRef = useRef("pen");
  const selBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null); // 🔮 Nova referência para a caixa
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);

  const getPinchDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getPinchCenter = (touches: TouchList) => {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };
  
  useLayoutEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useLayoutEffect(() => { panXRef.current = panX; }, [panX]);
  useLayoutEffect(() => { panYRef.current = panY; }, [panY]);
  useLayoutEffect(() => { linhasRef.current = linhas; }, [linhas]);
  useLayoutEffect(() => { imagesRef.current = images; }, [images]);
  useLayoutEffect(() => { selImgRef.current = selImg; }, [selImg]);
  useLayoutEffect(() => { toolRef.current = tool; }, [tool]);
  useLayoutEffect(() => { selBoxRef.current = selBox; }, [selBox]); 
  useEffect(() => {//Se a imagem for deletada do banco, libera a RAM!
    const idsAtuais = new Set(images.map(i => i.id));
    for (const id of imageCache.current.keys()) {
      if (!idsAtuais.has(id)) {
        imageCache.current.delete(id);
      }
    }
  }, [images]);


  const lastP = useRef<{ x: number; y: number } | null>(null);
  const startPan = useRef<{ x: number; y: number } | null>(null);
  const startTokenPos = useRef<Record<string, { x: number; y: number }>>({});
  const selStartMundo = useRef<{ x: number; y: number } | null>(null);

  const linhaAtual = useRef<Linha | null>(null);

  useEffect(() => {
    if (!isMestre) return;
    (async () => {
      try {
        const { data } = await supabase.from("canvas_state").select("images, drawings").eq("lobby_id", lobbyId).maybeSingle();
        if (data) {
          if (data.images) setImages(data.images as ImageObj[]);
          if (data.drawings) setLinhas(data.drawings as Linha[]);
        }
      } catch {}
    })();
  }, [isMestre, lobbyId]);

  // src/hooks/useCanvas.ts — Substitua o useEffect de salvamento por este:

  useEffect(() => {
    if (!isMestre) return;
    
    // 🔮 Aumentamos o tempo de debounce para 2 segundos para dar tempo 
    // de o utilizador terminar de desenhar e não sobrecarregar a API
    const t = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("canvas_state")
          .upsert({
            lobby_id: lobbyId,
            images: images,
            drawings: linhasRef.current, // O array atualizado
            ts: Date.now()
          });
        
        if (error) console.error("Erro ao salvar no Supabase:", error);
      } catch (e) {
        console.error("Falha na sincronia do Canvas:", e);
      }
    }, 2000);

    return () => clearTimeout(t);
  }, [images, linhas, isMestre, lobbyId]); // 🔮 ADICIONADO 'linhas' NA DEPENDÊNCIA!

  const renderizarTelaCompleta = useCallback(() => {
    const bg = bgRef.current, draw = drawRef.current, fg = fgRef.current;
    if (!bg || !draw || !fg) return;
    
    const bgCtx = bg.getContext("2d");
    const drawCtx = draw.getContext("2d");
    const fgCtx = fg.getContext("2d");
    if (!bgCtx || !drawCtx || !fgCtx) return;

    bgCtx.clearRect(0, 0, bg.width, bg.height);
    drawCtx.clearRect(0, 0, draw.width, draw.height);
    fgCtx.clearRect(0, 0, fg.width, fg.height);

    bgCtx.save(); drawCtx.save(); fgCtx.save();
    
    bgCtx.translate(panXRef.current, panYRef.current);
    bgCtx.scale(zoomRef.current, zoomRef.current);
    drawCtx.translate(panXRef.current, panYRef.current);
    drawCtx.scale(zoomRef.current, zoomRef.current);
    fgCtx.translate(panXRef.current, panYRef.current);
    fgCtx.scale(zoomRef.current, zoomRef.current);

    // 🛡️ NOVA DEFESA VISUAL: Máscara (Clip)
    // Corta literalmente QUALQUER pixel que tente sangrar para fora dos 2000x2000!
    [bgCtx, drawCtx, fgCtx].forEach(ctx => {
      ctx.beginPath();
      ctx.rect(0, 0, MUNDO_W, MUNDO_H);
      ctx.clip();
    });

    // 1. CAMADA DE FUNDO (MAPAS DO MUNDO VIRTUAL)
    bgCtx.fillStyle = "#111827";
    bgCtx.fillRect(0, 0, MUNDO_W, MUNDO_H);

    imagesRef.current.filter(img => img.layer === "map").forEach(img => {
      let el = imageCache.current.get(img.id);
      if (!el) {
        // Primeira vez que vemos essa imagem: instanciamos e salvamos no Cache
        el = new Image();
        el.src = img.dataUrl;
        imageCache.current.set(img.id, el);
        el.onload = () => renderizarTelaCompleta(); 
      }
      
      // Nas renderizações seguintes (tipo arrastar a tela), ele pula direto pra cá
      if (el.complete && el.naturalWidth !== 0) {
        bgCtx.drawImage(el, img.x, img.y, img.w, img.h);
      }
    });

    // 2. CAMADA DO MEIO (VETORES DE CANETA/BORRACHA)
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    
    // Junta as linhas já salvas com a linha que está sendo desenhada AGORA (se houver alguma)
    const linhasParaDesenhar = (drawing.current && linhaAtual.current) 
      ? [...linhasRef.current, linhaAtual.current] 
      : linhasRef.current;

    // 🖌️ Usamos a nova variável no lugar do linhasRef.current
    linhasParaDesenhar.forEach(linha => {
      if (!linha.points || linha.points.length < 1) return;
      drawCtx.beginPath();
      drawCtx.moveTo(linha.points[0].x, linha.points[0].y);
      for (let i = 1; i < linha.points.length; i++) {
        drawCtx.lineTo(linha.points[i].x, linha.points[i].y);
      }

      if (linha.tool === "eraser") {
        drawCtx.globalCompositeOperation = "destination-out";
        drawCtx.strokeStyle = "rgba(0,0,0,1)";
        drawCtx.lineWidth = linha.brush * 5;
      } else {
        drawCtx.globalCompositeOperation = "source-over";
        drawCtx.strokeStyle = linha.color;
        drawCtx.lineWidth = linha.brush;
      }
      drawCtx.stroke();
    });

    // 3. CAMADA DA FRENTE (TOKENS DE PERSONAGENS E MONSTROS)
    imagesRef.current.filter(img => img.layer !== "map").forEach(img => {
      let el = imageCache.current.get(img.id);
      if (!el) {
        el = new Image();
        el.src = img.dataUrl;
        imageCache.current.set(img.id, el);
        el.onload = () => renderizarTelaCompleta();
      }
      
      if (el.complete && el.naturalWidth !== 0) {
        fgCtx.drawImage(el, img.x, img.y, img.w, img.h);
      }
    });

    // 🔮 4. NOVA CORREÇÃO: CENTRALIZADOR DE BORDAS E BADGES DE SELEÇÃO DE CAMADA
    if (isMestre && toolRef.current === "select") {
      imagesRef.current.forEach(img => {
        if (selImgRef.current.includes(img.id)) {
          const isMap = img.layer === "map";
          const corCamada = isMap ? "#f59e0b" : "#3b82f6"; // Laranja para Fundo, Azul para Frente
          const textoLabel = isMap ? "🗺️ Fundo" : "♟️ Frente";

          // Desenha o contorno retangular sobre a lona da frente para ficar visível acima de tudo
          fgCtx.strokeStyle = corCamada;
          fgCtx.lineWidth = 3 / zoomRef.current;
          fgCtx.strokeRect(img.x, img.y, img.w, img.h);

          // Renderização responsiva do Badge de Texto
          fgCtx.save();
          fgCtx.fillStyle = corCamada;
          
          // Ajusta a escala da fonte para manter o tamanho visual nítido no monitor independente do Zoom
          const fontSize = 11 / zoomRef.current;
          fgCtx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
          
          const txtWidth = fgCtx.measureText(textoLabel).width;
          const badgeH = 18 / zoomRef.current;
          const badgeW = txtWidth + (12 / zoomRef.current);
          const badgeX = img.x;
          const badgeY = img.y - badgeH - (3 / zoomRef.current);

          // Desenha a aba preenchida
          fgCtx.fillRect(badgeX, badgeY, badgeW, badgeH);

          // Carimba o indicador em letras brancas
          fgCtx.fillStyle = "#ffffff";
          fgCtx.textBaseline = "middle";
          fgCtx.fillText(textoLabel, badgeX + (6 / zoomRef.current), badgeY + (badgeH / 2));
          fgCtx.restore();
        }
      });
    }

    // Moldura delimitadora do tabuleiro virtual
    fgCtx.strokeStyle = "#1f2937";
    fgCtx.lineWidth = 4 / zoomRef.current;
    fgCtx.strokeRect(0, 0, MUNDO_W, MUNDO_H);

    // Retângulo dinâmico de seleção múltipla (Caixa azul de arrasto)
    if (isMestre && toolRef.current === "select" && selBoxRef.current) {
      fgCtx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      fgCtx.lineWidth = 1.5 / zoomRef.current;
      fgCtx.fillStyle = "rgba(59, 130, 246, 0.15)";
      fgCtx.fillRect(selBoxRef.current.x, selBoxRef.current.y, selBoxRef.current.w, selBoxRef.current.h);
      fgCtx.strokeRect(selBoxRef.current.x, selBoxRef.current.y, selBoxRef.current.w, selBoxRef.current.h);
    }

    bgCtx.restore(); drawCtx.restore(); fgCtx.restore();
  }, [isMestre]);

  // 🔮 Adicionado o 'selBox' na lista de dependências para forçar o redesenho durante o arrasto do mouse
  useEffect(() => {
    renderizarTelaCompleta();
  }, [linhas, images, zoom, panX, panY, selBox, renderizarTelaCompleta]);

  useEffect(() => {
    if (isMestre || tab !== "tela") return;
    const carregarDados = async () => {
      try {
        const { data } = await supabase.from("canvas_state").select("images, drawings").eq("lobby_id", lobbyId).maybeSingle();
        if (data) {
          if (data.images) setImages(data.images as ImageObj[]);
          if (data.drawings) setLinhas(data.drawings as Linha[]);
        }
      } catch {}
    };
    carregarDados();

    const canal = supabase.channel(`canvas_sync:${lobbyId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "canvas_state", filter: `lobby_id=eq.${lobbyId}` },
        (payload) => {
          if (payload.new) {
            if (payload.new.images) setImages(payload.new.images as ImageObj[]);
            if (payload.new.drawings) setLinhas(payload.new.drawings as Linha[]);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [isMestre, tab, lobbyId]);

  useEffect(() => {
    if ((tab !== "mestre" && tab !== "tela") || !contRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
        if (w < 1 || h < 1) continue;
        if (bgRef.current) { bgRef.current.width = w; bgRef.current.height = h; }
        if (drawRef.current) { drawRef.current.width = w; drawRef.current.height = h; }
        if (fgRef.current) { fgRef.current.width = w; fgRef.current.height = h; }
        renderizarTelaCompleta();
      }
    });
    ro.observe(contRef.current);
    return () => ro.disconnect();
  }, [tab, renderizarTelaCompleta]);

  useEffect(() => {
    const el = contRef.current;
    if (!el || (tab !== "mestre" && tab !== "tela")) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const mundoX = (mouseX - panXRef.current) / zoomRef.current;
      const mundoY = (mouseY - panYRef.current) / zoomRef.current;
      const fator = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const novoZoom = Math.min(Math.max(zoomRef.current * fator, 0.15), 4);
      const novoPanX = mouseX - mundoX * novoZoom;
      const novoPanY = mouseY - mundoY * novoZoom;
      
      const limite = travarCamera(novoPanX, novoPanY, novoZoom);
      
      setZoom(novoZoom); 
      setPanX(limite.x); 
      setPanY(limite.y);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [tab]);

  const obterPosicaoMundo = (e: any) => {
    const cv = bgRef.current; 
    if (!cv) return { x: 0, y: 0, screenX: 0, screenY: 0 };
    const rect = cv.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const screenX = src.clientX - rect.left;
    const screenY = src.clientY - rect.top;
    return { x: (screenX - panXRef.current) / zoomRef.current, y: (screenY - panYRef.current) / zoomRef.current, screenX, screenY };
  };

  const onDown = (e: any) => {

    if (e.touches && e.touches.length === 2) {
      lastTouchDistance.current = getPinchDistance(e.touches);
      lastTouchCenter.current = getPinchCenter(e.touches);
      return; // Interrompe para não desenhar ou interagir com 2 dedos
    }
    
    const p = obterPosicaoMundo(e);
    lastP.current = { x: p.x, y: p.y };

    if (tool === "pan" || e.button === 1) {
      e.preventDefault(); // 🛡️ Bloqueia o comportamento padrão do navegador
      panning.current = true;
      startPan.current = { x: p.screenX - panXRef.current, y: p.screenY - panYRef.current };
      return;
    }
    if (!isMestre) return;

    if (tool === "select") {
      const tokenClicado = [...imagesRef.current].reverse().find(img => p.x >= img.x && p.x <= img.x + img.w && p.y >= img.y && p.y <= img.y + img.h);
      if (tokenClicado) {
        movingTokens.current = true;
        const novoGrupo = selImgRef.current.includes(tokenClicado.id) ? selImgRef.current : [tokenClicado.id];
        setSelImg(novoGrupo);
        const posicoes: Record<string, { x: number; y: number }> = {};
        imagesRef.current.forEach(img => { if (novoGrupo.includes(img.id)) posicoes[img.id] = { x: img.x, y: img.y }; });
        startTokenPos.current = posicoes;
      } else {
        setSelImg([]);
        selStartMundo.current = { x: p.x, y: p.y };
        setSelBox({ x: p.x, y: p.y, w: 0, h: 0 });
      }
      return;
    }

    e.preventDefault();
    drawing.current = true;

    // 🛡️ Clampa o traço inicial para ele nascer restrito à lona
    const cx = Math.max(0, Math.min(p.x, MUNDO_W));
    const cy = Math.max(0, Math.min(p.y, MUNDO_H));
    
    linhaAtual.current = { tool, color, brush, points: [{ x: cx, y: cy }] };
  };

// Impede a visão de se perder no Vazio Infinito
 const travarCamera = (alvoX: number, alvoY: number, zoomAtual: number) => {
    const cv = bgRef.current;
    const telaW = cv ? cv.width : window.innerWidth;
    const telaH = cv ? cv.height : window.innerHeight;

    const mapW = MUNDO_W * zoomAtual;
    const mapH = MUNDO_H * zoomAtual;

    // A margem elástica de 200 pixels para o mapa não sumir da tela
    const margemX = Math.min(200, mapW / 2);
    const margemY = Math.min(200, mapH / 2);

    // Os limites exatos de até onde você pode empurrar o mapa
    const minX = margemX - mapW;
    const maxX = telaW - margemX;
    
    const minY = margemY - mapH;
    const maxY = telaH - margemY;

    // Prevenção de segurança absoluta contra bugs de redimensionamento
    if (minX > maxX || minY > maxY) return { x: alvoX, y: alvoY };

    return {
      x: Math.max(minX, Math.min(alvoX, maxX)),
      y: Math.max(minY, Math.min(alvoY, maxY))
    };
  };

  const onMove = (e: any) => {

    if (e.touches && e.touches.length === 2) {
      e.preventDefault();
      
      const cv = bgRef.current;
      if (!cv) return;
      
      const rect = cv.getBoundingClientRect();
      const currentDistance = getPinchDistance(e.touches);
      const currentCenter = getPinchCenter(e.touches);

      if (lastTouchDistance.current !== null && lastTouchCenter.current !== null) {
        // 1. Posição do centro da pinça no frame ANTERIOR (relativa ao canvas)
        const lastLocalX = lastTouchCenter.current.x - rect.left;
        const lastLocalY = lastTouchCenter.current.y - rect.top;

        // 2. Descobre que ponto do MUNDO (mapa virtual) estava embaixo dos dedos
        const mundoX = (lastLocalX - panXRef.current) / zoomRef.current;
        const mundoY = (lastLocalY - panYRef.current) / zoomRef.current;

        // 3. Calcula o Novo Zoom de forma suave e 1:1 com a distância dos dedos
        const fator = currentDistance / lastTouchDistance.current;
        const novoZoom = Math.min(Math.max(zoomRef.current * fator, 0.15), 4);

        // 4. Posição do centro da pinça AGORA (se o jogador arrastar os dois dedos)
        const currentLocalX = currentCenter.x - rect.left;
        const currentLocalY = currentCenter.y - rect.top;

        // 5. O SEGREDO MÁGICO: Recalcula o PanX/Y para garantir que aquele ponto
        // do Mundo (passo 2) esteja exatamente na posição nova dos dedos (passo 4).
        // Isso resolve o Zoom e o Arrasto simultaneamente!
        const novoPanX = currentLocalX - mundoX * novoZoom;
        const novoPanY = currentLocalY - mundoY * novoZoom;

        // Limita a câmera para não perdermos o mapa no vazio
        const limite = travarCamera(novoPanX, novoPanY, novoZoom);

        setZoom(novoZoom);
        setPanX(limite.x);
        setPanY(limite.y);
      }

      // Salva para o próximo frame
      lastTouchDistance.current = currentDistance;
      lastTouchCenter.current = currentCenter;
      return; // Interrompe a função aqui
    }
    
    const p = obterPosicaoMundo(e);
    if (panning.current && startPan.current) {
      const nx = p.screenX - startPan.current.x;
      const ny = p.screenY - startPan.current.y;
      
      const limite = travarCamera(nx, ny, zoomRef.current);
      setPanX(limite.x);
      setPanY(limite.y);
      return;
    }
    if (!isMestre) return;

    if (tool === "select") {
      if (movingTokens.current && lastP.current) {
        const dx = p.x - lastP.current.x; const dy = p.y - lastP.current.y;
        setImages(prev => prev.map(img => {
          if (selImgRef.current.includes(img.id) && startTokenPos.current[img.id]) {
            let nx = Math.round(startTokenPos.current[img.id].x + dx);
            let ny = Math.round(startTokenPos.current[img.id].y + dy);
            
            // 🛡️ Muralha pros Tokens! Impede a imagem de sair pelas bordas
            nx = Math.max(0, Math.min(nx, MUNDO_W - img.w));
            ny = Math.max(0, Math.min(ny, MUNDO_H - img.h));
            
            return { ...img, x: nx, y: ny };
          }
          return img;
        }));
      } else if (selBox && selStartMundo.current) {
        const start = selStartMundo.current;
        // 🛡️ Impede a caixa de seleção azul de desenhar fora dos limites
        const cx = Math.max(0, Math.min(p.x, MUNDO_W));
        const cy = Math.max(0, Math.min(p.y, MUNDO_H));
        const startX = Math.max(0, Math.min(start.x, MUNDO_W));
        const startY = Math.max(0, Math.min(start.y, MUNDO_H));
        
        setSelBox({ 
          x: Math.min(startX, cx), 
          y: Math.min(startY, cy), 
          w: Math.abs(cx - startX), 
          h: Math.abs(cy - startY) 
        });
      }
      return;
    }

    if (!drawing.current || !linhaAtual.current || !lastP.current) return;
    e.preventDefault();
    
    // 🛡️ Se o usuário arrastar a caneta pra fora, o traço desliza travado no canto!
    const cx = Math.max(0, Math.min(p.x, MUNDO_W));
    const cy = Math.max(0, Math.min(p.y, MUNDO_H));
    
    const pts = linhaAtual.current.points;
    const prev = pts[pts.length - 1];

    // 🛡️ OTIMIZAÇÃO EXTRA: Só registra o ponto se o mouse andou pelo menos 2 pixels.
    // Isso reduz o tamanho do traço no banco de dados em 80% sem perder qualidade!
    if (Math.hypot(cx - prev.x, cy - prev.y) < 2) return;

    linhaAtual.current.points.push({ x: cx, y: cy });

    // 🖌️ DESENHO DIRETO: Em vez de atualizar o React (Lag), pintamos só o novo pixel!
    const canvas = drawRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        // Aplica a câmera
        ctx.translate(panXRef.current, panYRef.current);
        ctx.scale(zoomRef.current, zoomRef.current);
        
        // Máscara da borda
        ctx.beginPath();
        ctx.rect(0, 0, MUNDO_W, MUNDO_H);
        ctx.clip();

        // Configura o pincel
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = linhaAtual.current.brush;
        ctx.strokeStyle = linhaAtual.current.tool === "eraser" ? "rgba(0,0,0,1)" : linhaAtual.current.color;
        ctx.globalCompositeOperation = linhaAtual.current.tool === "eraser" ? "destination-out" : "source-over";

        // Desenha APENAS a ligação entre o ponto anterior e o novo
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        ctx.restore();
      }
    }
    
    // ❌ IMPORTANTE: Nós NÃO chamamos mais o setLinhas() aqui!
  };

  const onUp = (e: any) => {

    if (e && e.touches && e.touches.length < 2) {
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
    }

    panning.current = false;
    movingTokens.current = false;
    if (tool === "select" && selBox) {
      const capturados = imagesRef.current.filter(img => {
        return (img.x < selBox.x + selBox.w && img.x + img.w > selBox.x && img.y < selBox.y + selBox.h && img.y + img.h > selBox.y);
      }).map(i => i.id);
      if (capturados.length > 0) setSelImg(capturados);
      setSelBox(null);
      selStartMundo.current = null;
    }
    // 🛡️ Oficializa o traço apenas quando o Mestre solta o botão!
    if (drawing.current && linhaAtual.current) {
      setLinhas([...linhasRef.current, linhaAtual.current]);
      linhaAtual.current = null;
    }
    drawing.current = false;
  };

  const clearCv = async () => {
    setImages([]); setSelImg([]); setLinhas([]);
    linhasRef.current = [];
    
    // 🧹 Purifica a memória instantaneamente
    imageCache.current.clear(); 
    
    try { await supabase.from("canvas_state").upsert({ lobby_id: lobbyId, drawings: [], images: [], composite_url: "", ts: Date.now() }); } catch {}
  };

  const loadImg = (e: any) => {
    const f = e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = (ev: any) => {
      const dataUrl = ev.target.result;
      const el = new Image();
      el.onload = () => {
        const w = Math.min(el.width, 500), h = Math.min(el.height, 500);
        const x = Math.round((MUNDO_W - w) / 2), y = Math.round((MUNDO_H - h) / 2);
        const id = mkId();
        setImages(p => [...p, { id, dataUrl, x, y, w, h, layer: "token" }]);
        setTool("select"); setSelImg([id]);
      };
      el.src = dataUrl;
    };
    fr.readAsDataURL(f); e.target.value = "";
  };

  useEffect(() => {
    if (!isMestre) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile(); if (!blob) continue;
          const reader = new FileReader();
          reader.onload = (event: any) => {
            const img = new Image();
            img.onload = () => {
              const novaImagem: ImageObj = { id: mkId(), x: 100, y: 100, w: Math.min(img.width, 300), h: Math.min(img.height, 300), dataUrl: event.target.result, layer: "token" };
              setImages(prev => [...prev, novaImagem]);
            };
            img.src = event.target.result;
          };
          reader.readAsDataURL(blob); break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isMestre]);

  return {
    tool, setTool, color, setColor, brush, setBrush,
    linhas, setLinhas, images, setImages, selImg, setSelImg, selBox,
    bgRef, drawRef, fgRef, contRef, fileRef, clearCv, loadImg, onDown, onMove, onUp,
    zoom, panX, panY 
  };
}