// src/hooks/useCanvas.ts
import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import type { Linha, ImageObj } from "../types";
import { supabase } from "../lib/supabase";
 
const mkId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
 
const MUNDO_W = 2000;
const MUNDO_H = 2000;
 
// Tamanho visual da alça de redimensionamento em pixels de ecrã
const HANDLE_VISUAL_PX = 10;
const HANDLE_HIT_PX = 22;

const TEMPO_PING = 4000;

type PingObj = { id: string; x: number; y: number; color: string; ts: number };
 
export function useCanvas(lobbyId: string, isMestre: boolean, tab: string) {
  const [tool, setTool] = useState(isMestre ? "pen" : "pan"); 
  const [color, setColor] = useState("#ef4444");
  const [brush, setBrush] = useState(5);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [images, setImages] = useState<ImageObj[]>([]);
  const [selImg, setSelImg] = useState<string[]>([]);
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const showGridRef = useRef(false);

  const [pings, setPings] = useState<PingObj[]>([]);
 
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
 
  const bgRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<HTMLCanvasElement | null>(null);
  const fgRef = useRef<HTMLCanvasElement | null>(null);
  
  const contRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  
  const drawing = useRef(false);
  const panning = useRef(false);
  const movingTokens = useRef(false);
 
  const resizingImg = useRef<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const lastPingTs = useRef<number>(0);
  const pingsRef = useRef<PingObj[]>([]);
 
  const zoomRef = useRef(1);
  const panXRef = useRef(0);
  const panYRef = useRef(0);
  const linhasRef = useRef<Linha[]>([]);
  const imagesRef = useRef<ImageObj[]>([]);
  const selImgRef = useRef<string[]>([]);
  const toolRef = useRef("pen");
  const selBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
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
  useLayoutEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useLayoutEffect(() => { pingsRef.current = pings; }, [pings]);

  useEffect(() => {
    const idsAtuais = new Set(images.map(i => i.id));
    for (const id of imageCache.current.keys()) {
      if (!idsAtuais.has(id)) {
        imageCache.current.delete(id);
      }
    }
  }, [images]);

  useEffect(() => {
    if (!isMestre) {
      setTool("pan");
      setSelImg([]);
    }
  }, [isMestre]);
 
  const lastP = useRef<{ x: number; y: number } | null>(null);
  const startPan = useRef<{ x: number; y: number } | null>(null);
  const startTokenPos = useRef<Record<string, { x: number; y: number }>>({});
  const selStartMundo = useRef<{ x: number; y: number } | null>(null);
  const linhaAtual = useRef<Linha | null>(null);
  const broadcastRef = useRef<any>(null);
  const lastBroadcast = useRef(0);
  
  // 🔮 Busca o estado do mapa quando o Mestre entra na sala
  useEffect(() => {
    if (!isMestre) return;
    (async () => {
      try {
        const { data } = await supabase.from("canvas_state").select("images, drawings, show_grid").eq("lobby_id", lobbyId).maybeSingle();
        if (data) {
          if (data.images) setImages(data.images as ImageObj[]);
          if (data.drawings) setLinhas(data.drawings as Linha[]);
          if (data.show_grid !== undefined) setShowGrid(data.show_grid); // Puxa a grid guardada
        }
      } catch {}
    })();
  }, [isMestre, lobbyId]);
 
  // 🔮 O Motor de Sincronização em Tempo Real do Mestre
  useEffect(() => {
    if (!isMestre) return;
 
    let tFast: any;
    const dispararBroadcast = () => {
      if (broadcastRef.current) {
        broadcastRef.current.send({
          type: "broadcast",
          event: "canvas_fast",
          payload: { images: images, drawings: linhasRef.current, showGrid: showGridRef.current } // Envia a grid ao vivo!
        });
      }
      lastBroadcast.current = Date.now();
    };
 
    if (Date.now() - lastBroadcast.current > 80) {
      dispararBroadcast();
    } else {
      tFast = setTimeout(dispararBroadcast, 80);
    }
 
    const tSlow = setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("canvas_state")
          .upsert({
            lobby_id: lobbyId,
            images: images,
            drawings: linhasRef.current,
            show_grid: showGridRef.current, // Guarda a grid na base de dados!
            ts: Date.now()
          });
        
        if (error) console.error("Erro ao salvar no Supabase:", error);
      } catch (e) {
        console.error("Falha na sincronia do Canvas:", e);
      }
    }, 2000);
 
    return () => {
      clearTimeout(tFast);
      clearTimeout(tSlow);
    };
  // 📍 ATENÇÃO AQUI: showGrid foi adicionado às dependências!
  }, [images, linhas, showGrid, isMestre, lobbyId]);
 
  const dispararPing = useCallback((px: number, py: number, cor: string) => {
    const newPing = { id: mkId(), x: px, y: py, color: cor, ts: Date.now() };
    setPings(prev => [...prev, newPing]);
    
    if (broadcastRef.current) {
      broadcastRef.current.send({ type: "broadcast", event: "canvas_ping", payload: newPing });
    }
  }, []);

  const isOverResizeHandle = useCallback((px: number, py: number, img: ImageObj): boolean => {
    const hs = HANDLE_HIT_PX / zoomRef.current;
    return (
      px >= img.x + img.w - hs &&
      px <= img.x + img.w + hs * 0.5 &&
      py >= img.y + img.h - hs &&
      py <= img.y + img.h + hs * 0.5
    );
  }, []);
 
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
 
    [bgCtx, drawCtx, fgCtx].forEach(ctx => {
      ctx.beginPath();
      ctx.rect(0, 0, MUNDO_W, MUNDO_H);
      ctx.clip();
    });
 
    bgCtx.fillStyle = "#111827";
    bgCtx.fillRect(0, 0, MUNDO_W, MUNDO_H);
 
    imagesRef.current.filter(img => img.layer === "map").forEach(img => {
      let el = imageCache.current.get(img.id);
      if (!el) {
        el = new Image();
        el.src = img.dataUrl;
        imageCache.current.set(img.id, el);
        el.onload = () => renderizarTelaCompleta(); 
      }
      if (el.complete && el.naturalWidth !== 0) {
        bgCtx.drawImage(el, img.x, img.y, img.w, img.h);
      }
    });

    if (showGridRef.current) {
      bgCtx.save();
      bgCtx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      bgCtx.lineWidth = 1;
      const gridSize = 100;
      bgCtx.beginPath();
      for (let x = 0; x <= MUNDO_W; x += gridSize) {
        bgCtx.moveTo(x, 0);
        bgCtx.lineTo(x, MUNDO_H);
      }
      for (let y = 0; y <= MUNDO_H; y += gridSize) {
        bgCtx.moveTo(0, y);
        bgCtx.lineTo(MUNDO_W, y);
      }
      bgCtx.stroke();
      bgCtx.restore();
    }
 
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    
    const linhasParaDesenhar = (drawing.current && linhaAtual.current) 
      ? [...linhasRef.current, linhaAtual.current] 
      : linhasRef.current;
 
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
        drawCtx.lineWidth = linha.brush * 3;
      } else {
        drawCtx.globalCompositeOperation = "source-over";
        drawCtx.strokeStyle = linha.color;
        drawCtx.lineWidth = linha.brush;
      }
      drawCtx.stroke();
    });
 
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

    const agora = Date.now();
    pingsRef.current.forEach(ping => {
      const idade = agora - ping.ts;
      if (idade < TEMPO_PING) { 
        fgCtx.save();
        let yOffset = 0;
        if (idade < 150) yOffset = -20 * (1 - (idade / 150));
        let alpha = 1;
        if (idade > TEMPO_PING - 200) alpha = Math.max(0, (TEMPO_PING - idade) / 200);
        fgCtx.globalAlpha = alpha;
        
        const px = ping.x;
        const py = ping.y + yOffset;
        const r = 16 / zoomRef.current;
        const cy = py - r * 1.5;
        
        fgCtx.beginPath();
        fgCtx.arc(px, cy, r, Math.PI * 0.15, Math.PI * 0.85, true);
        fgCtx.lineTo(px, py);
        fgCtx.closePath();
        
        fgCtx.shadowColor = "rgba(0,0,0,0.5)";
        fgCtx.shadowBlur = 6 / zoomRef.current;
        fgCtx.shadowOffsetY = 3 / zoomRef.current;
        fgCtx.fillStyle = ping.color;
        fgCtx.fill();
        
        fgCtx.shadowColor = "transparent"; 
        fgCtx.lineWidth = 2.5 / zoomRef.current;
        fgCtx.strokeStyle = "#ffffff";
        fgCtx.stroke();
        
        fgCtx.beginPath();
        fgCtx.arc(px, cy, r * 0.35, 0, Math.PI * 2);
        fgCtx.fillStyle = "#ffffff";
        fgCtx.fill();
        fgCtx.restore();
      }
    });
 
    if (isMestre && toolRef.current === "select") {
      imagesRef.current.forEach(img => {
        if (selImgRef.current.includes(img.id)) {
          const isMap = img.layer === "map";
          const corCamada = isMap ? "#f59e0b" : "#3b82f6";
          const textoLabel = isMap ? "🗺️ Fundo" : "♟️ Frente";
 
          fgCtx.strokeStyle = corCamada;
          fgCtx.lineWidth = 3 / zoomRef.current;
          fgCtx.strokeRect(img.x, img.y, img.w, img.h);
 
          fgCtx.save();
          fgCtx.fillStyle = corCamada;
          const fontSize = 11 / zoomRef.current;
          fgCtx.font = `bold ${fontSize}px 'Segoe UI', sans-serif`;
          const txtWidth = fgCtx.measureText(textoLabel).width;
          const badgeH = 18 / zoomRef.current;
          const badgeW = txtWidth + (12 / zoomRef.current);
          const badgeX = img.x;
          const badgeY = img.y - badgeH - (3 / zoomRef.current);
          fgCtx.fillRect(badgeX, badgeY, badgeW, badgeH);
          fgCtx.fillStyle = "#ffffff";
          fgCtx.textBaseline = "middle";
          fgCtx.fillText(textoLabel, badgeX + (6 / zoomRef.current), badgeY + (badgeH / 2));
          fgCtx.restore();
 
          const hv = HANDLE_VISUAL_PX / zoomRef.current;
          const handleX = img.x + img.w - hv;
          const handleY = img.y + img.h - hv;
 
          fgCtx.save();
          fgCtx.shadowColor = "rgba(0,0,0,0.5)";
          fgCtx.shadowBlur = 4 / zoomRef.current;
 
          fgCtx.fillStyle = "#ffffff";
          fgCtx.fillRect(handleX, handleY, hv * 2, hv * 2);
 
          fgCtx.strokeStyle = corCamada;
          fgCtx.lineWidth = 2 / zoomRef.current;
          fgCtx.strokeRect(handleX, handleY, hv * 2, hv * 2);
 
          fgCtx.fillStyle = corCamada;
          const arrowSize = hv * 0.9;
          const cx = handleX + hv;
          const cy = handleY + hv;
 
          fgCtx.beginPath();
          fgCtx.moveTo(cx + arrowSize * 0.15, cy + arrowSize * 0.15);
          fgCtx.lineTo(cx + arrowSize, cy + arrowSize * 0.15);
          fgCtx.lineTo(cx + arrowSize * 0.15, cy + arrowSize);
          fgCtx.closePath();
          fgCtx.fill();
 
          fgCtx.restore();
 
          const smallH = (HANDLE_VISUAL_PX * 0.65) / zoomRef.current;
          const corners = [
            { x: img.x - smallH,             y: img.y - smallH },
            { x: img.x + img.w - smallH,      y: img.y - smallH },
            { x: img.x - smallH,             y: img.y + img.h - smallH },
          ];
          corners.forEach(corner => {
            fgCtx.fillStyle = "#ffffff";
            fgCtx.fillRect(corner.x, corner.y, smallH * 2, smallH * 2);
            fgCtx.strokeStyle = corCamada;
            fgCtx.lineWidth = 1.5 / zoomRef.current;
            fgCtx.strokeRect(corner.x, corner.y, smallH * 2, smallH * 2);
          });
        }
      });
    }
 
    fgCtx.strokeStyle = "#1f2937";
    fgCtx.lineWidth = 4 / zoomRef.current;
    fgCtx.strokeRect(0, 0, MUNDO_W, MUNDO_H);
 
    if (isMestre && toolRef.current === "select" && selBoxRef.current) {
      fgCtx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      fgCtx.lineWidth = 1.5 / zoomRef.current;
      fgCtx.fillStyle = "rgba(59, 130, 246, 0.15)";
      fgCtx.fillRect(selBoxRef.current.x, selBoxRef.current.y, selBoxRef.current.w, selBoxRef.current.h);
      fgCtx.strokeRect(selBoxRef.current.x, selBoxRef.current.y, selBoxRef.current.w, selBoxRef.current.h);
    }
 
    bgCtx.restore(); drawCtx.restore(); fgCtx.restore();
  }, [isMestre]);
 
  useEffect(() => {
    renderizarTelaCompleta();
  }, [linhas, images, zoom, panX, panY, selBox, showGrid, renderizarTelaCompleta]);

  useEffect(() => {
    if (pings.length > 0) {
      let animationFrame: number;
      const renderLoop = () => {
        renderizarTelaCompleta();
        const agora = Date.now();
        
        if (pingsRef.current.some(p => agora - p.ts < TEMPO_PING)) {
          animationFrame = requestAnimationFrame(renderLoop);
        } else {
          setPings([]);
        }
      };
      animationFrame = requestAnimationFrame(renderLoop);
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [pings, renderizarTelaCompleta]);
 
  // 🔮 Os Jogadores recebem a Grid do servidor e ao vivo
  useEffect(() => {
    if (!isMestre && tab === "tela") {
      const carregarDados = async () => {
        try {
          const { data } = await supabase.from("canvas_state").select("images, drawings, show_grid").eq("lobby_id", lobbyId).maybeSingle();
          if (data) {
            if (data.images) setImages(data.images as ImageObj[]);
            if (data.drawings) setLinhas(data.drawings as Linha[]);
            if (data.show_grid !== undefined) setShowGrid(data.show_grid); // Puxa inicial
          }
        } catch {}
      };
      carregarDados();
    }
 
    const canal = supabase.channel(`mesa_live_${lobbyId}`);
 
    if (!isMestre) {
      canal.on("broadcast", { event: "canvas_fast" }, (payload) => {
        if (payload.payload.images) setImages(payload.payload.images);
        if (payload.payload.drawings) setLinhas(payload.payload.drawings);
        if (payload.payload.showGrid !== undefined) setShowGrid(payload.payload.showGrid); // Recebe ao vivo!
      });
    }

    // Recebendo o Ping com Segurança de Tempo
    canal.on("broadcast", { event: "canvas_ping" }, (payload) => {
      const pingSeguro = { ...payload.payload, ts: Date.now() };
      setPings(prev => [...prev, pingSeguro]);
    });
 
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        broadcastRef.current = canal;
      }
    });
 
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
      return;
    }
    
    const p = obterPosicaoMundo(e);
    lastP.current = { x: p.x, y: p.y };

    if (tool === "ping") {
      const agora = Date.now();
      if (agora - lastPingTs.current < TEMPO_PING) return; 
      lastPingTs.current = agora;
      dispararPing(p.x, p.y, color);
      return; 
    }
 
    if (tool === "pan" || e.button === 1) {
      e.preventDefault();
      panning.current = true;
      startPan.current = { x: p.screenX - panXRef.current, y: p.screenY - panYRef.current };
      return;
    }
    if (!isMestre) return;
 
    if (tool === "select") {
      for (const img of [...imagesRef.current].reverse()) {
        if (selImgRef.current.includes(img.id) && isOverResizeHandle(p.x, p.y, img)) {
          resizingImg.current = {
            id: img.id,
            startMouseX: p.x,
            startMouseY: p.y,
            startW: img.w,
            startH: img.h,
          };
          return; 
        }
      }
 
      const tokenClicado = [...imagesRef.current].reverse().find(img =>
        p.x >= img.x && p.x <= img.x + img.w && p.y >= img.y && p.y <= img.y + img.h
      );
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
    const cx = Math.max(0, Math.min(p.x, MUNDO_W));
    const cy = Math.max(0, Math.min(p.y, MUNDO_H));
    linhaAtual.current = { tool, color, brush, points: [{ x: cx, y: cy }] };
  };
 
  const travarCamera = (alvoX: number, alvoY: number, zoomAtual: number) => {
    const cv = bgRef.current;
    const telaW = cv ? cv.width : window.innerWidth;
    const telaH = cv ? cv.height : window.innerHeight;
    const mapW = MUNDO_W * zoomAtual;
    const mapH = MUNDO_H * zoomAtual;
    const margemX = Math.min(200, mapW / 2);
    const margemY = Math.min(200, mapH / 2);
    const minX = margemX - mapW;
    const maxX = telaW - margemX;
    const minY = margemY - mapH;
    const maxY = telaH - margemY;
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
        const lastLocalX = lastTouchCenter.current.x - rect.left;
        const lastLocalY = lastTouchCenter.current.y - rect.top;
        const mundoX = (lastLocalX - panXRef.current) / zoomRef.current;
        const mundoY = (lastLocalY - panYRef.current) / zoomRef.current;
        const fator = currentDistance / lastTouchDistance.current;
        const novoZoom = Math.min(Math.max(zoomRef.current * fator, 0.15), 4);
        const currentLocalX = currentCenter.x - rect.left;
        const currentLocalY = currentCenter.y - rect.top;
        const novoPanX = currentLocalX - mundoX * novoZoom;
        const novoPanY = currentLocalY - mundoY * novoZoom;
        const limite = travarCamera(novoPanX, novoPanY, novoZoom);
        setZoom(novoZoom);
        setPanX(limite.x);
        setPanY(limite.y);
      }
      lastTouchDistance.current = currentDistance;
      lastTouchCenter.current = currentCenter;
      return;
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
      if (resizingImg.current) {
        const { id, startMouseX, startMouseY, startW, startH } = resizingImg.current;
        const dx = p.x - startMouseX;
        const dy = p.y - startMouseY;
        setImages(prev => prev.map(img => {
          if (img.id !== id) return img;
          const newW = Math.max(20, Math.min(startW + dx, MUNDO_W - img.x));
          const newH = Math.max(20, Math.min(startH + dy, MUNDO_H - img.y));
          return { ...img, w: Math.round(newW), h: Math.round(newH) };
        }));
        return;
      }
 
      if (movingTokens.current && lastP.current) {
        const dx = p.x - lastP.current.x; const dy = p.y - lastP.current.y;
        setImages(prev => prev.map(img => {
          if (selImgRef.current.includes(img.id) && startTokenPos.current[img.id]) {
            let nx = Math.round(startTokenPos.current[img.id].x + dx);
            let ny = Math.round(startTokenPos.current[img.id].y + dy);
            nx = Math.max(0, Math.min(nx, MUNDO_W - img.w));
            ny = Math.max(0, Math.min(ny, MUNDO_H - img.h));
            return { ...img, x: nx, y: ny };
          }
          return img;
        }));
      } else if (selBox && selStartMundo.current) {
        const start = selStartMundo.current;
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
    
    const cx = Math.max(0, Math.min(p.x, MUNDO_W));
    const cy = Math.max(0, Math.min(p.y, MUNDO_H));
    const pts = linhaAtual.current.points;
    const prev = pts[pts.length - 1];
    if (Math.hypot(cx - prev.x, cy - prev.y) < 2) return;
 
    linhaAtual.current.points.push({ x: cx, y: cy });
 
    const canvas = drawRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.translate(panXRef.current, panYRef.current);
        ctx.scale(zoomRef.current, zoomRef.current);
        ctx.beginPath();
        ctx.rect(0, 0, MUNDO_W, MUNDO_H);
        ctx.clip();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = linhaAtual.current.tool === "eraser" ? linhaAtual.current.brush * 3 : linhaAtual.current.brush;
        ctx.strokeStyle = linhaAtual.current.tool === "eraser" ? "rgba(0,0,0,1)" : linhaAtual.current.color;
        ctx.globalCompositeOperation = linhaAtual.current.tool === "eraser" ? "destination-out" : "source-over";
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.restore();
      }
    }
  };
 
  const onUp = (e: any) => {
    if (e && e.touches && e.touches.length < 2) {
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
    }
 
    if (resizingImg.current) {
      resizingImg.current = null;
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
 
    if (drawing.current && linhaAtual.current) {
      setLinhas([...linhasRef.current, linhaAtual.current]);
      linhaAtual.current = null;
    }
    drawing.current = false;
  };
 
  const clearCv = async () => {
    await deleteImagesFromStorage(imagesRef.current);
    setImages([]); setSelImg([]); setLinhas([]);
    linhasRef.current = [];
    imageCache.current.clear(); 
    try { await supabase.from("canvas_state").upsert({ lobby_id: lobbyId, drawings: [], images: [], composite_url: "", ts: Date.now() }); } catch {}
  };
 
  // 🔮 MAGIA NOVA: Upload direto para o Supabase Storage ao carregar via botão
  const loadImg = async (e: any) => {
    const f = e.target.files[0]; 
    if (!f) return;
    e.target.value = ""; 

    // Cria um URL provisório só para ler o tamanho natural da imagem
    const tempUrl = URL.createObjectURL(f);
    const el = new Image();
    
    el.onload = async () => {
      const w = Math.min(el.width, 500), h = Math.min(el.height, 500);
      const x = Math.round((MUNDO_W - w) / 2), y = Math.round((MUNDO_H - h) / 2);
      const id = mkId();
      
      const fileExt = f.name.split('.').pop() || "png";
      const filePath = `${lobbyId}/${id}.${fileExt}`;

      try {
        const { error } = await supabase.storage.from("canvas_images").upload(filePath, f);
        if (error) throw error;

        const { data } = supabase.storage.from("canvas_images").getPublicUrl(filePath);
        
        setImages(p => [...p, { id, dataUrl: data.publicUrl, x, y, w, h, layer: "token" }]);
        setTool("select"); setSelImg([id]);
      } catch (err) {
        console.error("Falha ao subir a imagem para o Supabase Storage:", err);
        alert("A magia falhou! A imagem não pôde ser enviada para a mesa.");
      } finally {
        URL.revokeObjectURL(tempUrl);
      }
    };
    el.src = tempUrl;
  };

  // 🔮 MAGIA NOVA: Elimina fisicamente os ficheiros do Storage
  const deleteImagesFromStorage = async (imagesToDelete: ImageObj[]) => {
    // Extrai apenas o caminho interno do ficheiro a partir do URL público
    const paths = imagesToDelete
      .filter(img => img.dataUrl.includes("/canvas_images/")) // Garante que está no storage
      .map(img => img.dataUrl.split('/canvas_images/')[1])
      .filter(Boolean);

    if (paths.length > 0) {
      try {
        await supabase.storage.from("canvas_images").remove(paths);
      } catch (err) {
        console.error("Erro ao eliminar imagens do Cofre:", err);
      }
    }
  };

  // 🔮 MAGIA NOVA: Elimina as imagens selecionadas (Ecrã + Storage)
  const deleteSelectedImages = async () => {
    const toDelete = imagesRef.current.filter(img => selImgRef.current.includes(img.id));
    await deleteImagesFromStorage(toDelete); // Apaga do Supabase
    setImages(prev => prev.filter(img => !selImgRef.current.includes(img.id))); // Apaga do ecrã
    setSelImg([]);
  };
 
  // 🔮 MAGIA NOVA: Upload direto para o Supabase Storage ao colar (Ctrl+V)
  useEffect(() => {
    if (!isMestre) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items; if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile(); if (!blob) continue;
          
          const tempUrl = URL.createObjectURL(blob);
          const img = new Image();
          
          img.onload = async () => {
            const w = Math.min(img.width, 300), h = Math.min(img.height, 300);
            const x = 100, y = 100;
            const id = mkId();
            const filePath = `${lobbyId}/${id}.png`;
            
            try {
              const { error } = await supabase.storage.from("canvas_images").upload(filePath, blob);
              if (error) throw error;
              
              const { data } = supabase.storage.from("canvas_images").getPublicUrl(filePath);
              setImages(prev => [...prev, { id, x, y, w, h, dataUrl: data.publicUrl, layer: "token" }]);
            } catch (err) {
              console.error("Falha ao colar e enviar imagem:", err);
            } finally {
              URL.revokeObjectURL(tempUrl);
            }
          };
          img.src = tempUrl;
          break;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isMestre, lobbyId]);
 
  return {
    tool, setTool, color, setColor, brush, setBrush,
    linhas, setLinhas, images, setImages, selImg, setSelImg, selBox,
    bgRef, drawRef, fgRef, contRef, fileRef, clearCv, loadImg, onDown, onMove, onUp,
    zoom, panX, panY,
    showGrid, setShowGrid,
    deleteSelectedImages 
  };
}