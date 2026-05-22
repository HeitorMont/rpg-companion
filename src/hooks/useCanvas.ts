// src/hooks/useCanvas.ts
import { useState, useRef, useEffect, useCallback } from "react";
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

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);
  useEffect(() => { linhasRef.current = linhas; }, [linhas]);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => { selImgRef.current = selImg; }, [selImg]);
  useEffect(() => { toolRef.current = tool; }, [tool]);

  const lastP = useRef<{ x: number; y: number } | null>(null);
  const startPan = useRef<{ x: number; y: number } | null>(null);
  const startTokenPos = useRef<Record<string, { x: number; y: number }>>({});
  const selStartMundo = useRef<{ x: number; y: number } | null>(null);

  const canvasOk = useRef(false);
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

  useEffect(() => {
    if (!isMestre) return;
    const t = setTimeout(async () => {
      try {
        await supabase.from("canvas_state").upsert({ lobby_id: lobbyId, images: images, drawings: linhasRef.current, ts: Date.now() });
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [images, isMestre, lobbyId]);

  const renderizarTelaCompleta = useCallback(() => {
    const bg = bgRef.current, draw = drawRef.current, fg = fgRef.current;
    if (!bg || !draw || !fg) return;
    
    const bgCtx = bg.getContext("2d");
    const drawCtx = draw.getContext("2d");
    const fgCtx = fg.getContext("2d");
    if (!bgCtx || !drawCtx || !fgCtx) return;

    // Limpa as 3 lonas
    bgCtx.clearRect(0, 0, bg.width, bg.height);
    drawCtx.clearRect(0, 0, draw.width, draw.height);
    fgCtx.clearRect(0, 0, fg.width, fg.height);

    bgCtx.save(); drawCtx.save(); fgCtx.save();
    
    // Aplica a câmera matemática a todas as camadas ao mesmo tempo!
    bgCtx.translate(panXRef.current, panYRef.current);
    bgCtx.scale(zoomRef.current, zoomRef.current);
    drawCtx.translate(panXRef.current, panYRef.current);
    drawCtx.scale(zoomRef.current, zoomRef.current);
    fgCtx.translate(panXRef.current, panYRef.current);
    fgCtx.scale(zoomRef.current, zoomRef.current);

    // ----------------------------------------------------------------
    // 1. CAMADA DE FUNDO (MAPAS E MESA ESCURA)
    // ----------------------------------------------------------------
    bgCtx.fillStyle = "#111827";
    bgCtx.fillRect(0, 0, MUNDO_W, MUNDO_H);

    imagesRef.current.filter(img => img.layer === "map").forEach(img => {
      const el = new Image();
      el.src = img.dataUrl;
      if (el.complete) {
        bgCtx.drawImage(el, img.x, img.y, img.w, img.h);
      } else {
        el.onload = () => renderizarTelaCompleta();
      }
    });

    // ----------------------------------------------------------------
    // 2. CAMADA DO MEIO (VETORES DE CANETA E BORRACHA NATIVA)
    // ----------------------------------------------------------------
    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";
    
    linhasRef.current.forEach(linha => {
      if (!linha.points || linha.points.length < 1) return;
      drawCtx.beginPath();
      drawCtx.moveTo(linha.points[0].x, linha.points[0].y);
      for (let i = 1; i < linha.points.length; i++) {
        drawCtx.lineTo(linha.points[i].x, linha.points[i].y);
      }

      if (linha.tool === "eraser") {
        // Agora funciona perfeito! Fura só a camada "drawCtx" sem tocar no "bgCtx"
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

    // ----------------------------------------------------------------
    // 3. CAMADA DA FRENTE (TOKENS E INTERFACE DO MESTRE)
    // ----------------------------------------------------------------
    imagesRef.current.filter(img => img.layer !== "map").forEach(img => {
      const el = new Image();
      el.src = img.dataUrl;
      if (el.complete) {
        fgCtx.drawImage(el, img.x, img.y, img.w, img.h);
      } else {
        el.onload = () => renderizarTelaCompleta();
      }

      if (isMestre && selImgRef.current.includes(img.id) && toolRef.current === "select") {
        fgCtx.strokeStyle = img.layer === "map" ? "#f59e0b" : "#3b82f6";
        fgCtx.lineWidth = 3 / zoomRef.current;
        fgCtx.strokeRect(img.x, img.y, img.w, img.h);
      }
    });

    fgCtx.strokeStyle = "#1f2937";
    fgCtx.lineWidth = 4 / zoomRef.current;
    fgCtx.strokeRect(0, 0, MUNDO_W, MUNDO_H);

    if (isMestre && toolRef.current === "select" && selBox) {
      fgCtx.strokeStyle = "rgba(59, 130, 246, 0.8)";
      fgCtx.lineWidth = 1.5 / zoomRef.current;
      fgCtx.fillStyle = "rgba(59, 130, 246, 0.15)";
      fgCtx.fillRect(selBox.x, selBox.y, selBox.w, selBox.h);
      fgCtx.strokeRect(selBox.x, selBox.y, selBox.w, selBox.h);
    }

    bgCtx.restore(); drawCtx.restore(); fgCtx.restore();
  }, [isMestre]);

  useEffect(() => {
    renderizarTelaCompleta();
  }, [linhas, images, zoom, panX, panY, renderizarTelaCompleta]);

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
    canvasOk.current = false;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
        if (w < 1 || h < 1) continue;
        if (bgRef.current) { bgRef.current.width = w; bgRef.current.height = h; }
        if (drawRef.current) { drawRef.current.width = w; drawRef.current.height = h; }
        if (fgRef.current) { fgRef.current.width = w; fgRef.current.height = h; }
        canvasOk.current = true;
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
      setZoom(novoZoom); setPanX(novoPanX); setPanY(novoPanY);
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [tab]);

  const obterPosicaoMundo = (e: any) => {
    const cv = bgRef.current; // Usando a camada de fundo como referência dimensional
    if (!cv) return { x: 0, y: 0, screenX: 0, screenY: 0 };
    const rect = cv.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const screenX = src.clientX - rect.left;
    const screenY = src.clientY - rect.top;
    return { x: (screenX - panXRef.current) / zoomRef.current, y: (screenY - panYRef.current) / zoomRef.current, screenX, screenY };
  };

  const onDown = (e: any) => {
    const p = obterPosicaoMundo(e);
    lastP.current = { x: p.x, y: p.y };
    if (tool === "pan" || e.button === 1) {
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
    linhaAtual.current = { tool, color, brush, points: [{ x: p.x, y: p.y }] };
  };

  const onMove = (e: any) => {
    const p = obterPosicaoMundo(e);
    if (panning.current && startPan.current) {
      setPanX(p.screenX - startPan.current.x);
      setPanY(p.screenY - startPan.current.y);
      return;
    }
    if (!isMestre) return;

    if (tool === "select") {
      if (movingTokens.current && lastP.current) {
        const dx = p.x - lastP.current.x; const dy = p.y - lastP.current.y;
        setImages(prev => prev.map(img => {
          if (selImgRef.current.includes(img.id) && startTokenPos.current[img.id]) {
            return { ...img, x: Math.round(startTokenPos.current[img.id].x + dx), y: Math.round(startTokenPos.current[img.id].y + dy) };
          }
          return img;
        }));
      } else if (selBox && selStartMundo.current) {
        const start = selStartMundo.current;
        setSelBox({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
      }
      return;
    }

    if (!drawing.current || !linhaAtual.current || !lastP.current) return;
    e.preventDefault();
    linhaAtual.current.points.push({ x: p.x, y: p.y });
    setLinhas([...linhasRef.current, linhaAtual.current]);
  };

  const onUp = () => {
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
      const novaLista = [...linhasRef.current, linhaAtual.current];
      setLinhas(novaLista);
      linhaAtual.current = null;
    }
    drawing.current = false;
  };

  const clearCv = async () => {
    setImages([]); setSelImg([]); setLinhas([]);
    linhasRef.current = [];
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