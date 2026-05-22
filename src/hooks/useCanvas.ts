// src/hooks/useCanvas.ts
import { useState, useRef, useEffect, useCallback } from "react";
import type { Linha, ImageObj } from "../types";
import { supabase } from "../lib/supabase"; // 👈 Conexão direta com o plano divino

const mkId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export function useCanvas(lobbyId: string, isMestre: boolean, tab: string) {
  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState("#ef4444");
  const [brush, setBrush] = useState(5);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [images, setImages] = useState<ImageObj[]>([]);
  const [selImg, setSelImg] = useState<string[]>([]);
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);
  const lastP = useRef<{ absX: number; absY: number; relX: number; relY: number; cssX: number; cssY: number } | null>(null);
  const lastSave = useRef(0);
  const canvasOk = useRef(false);
  const linhaAtual = useRef<Linha | null>(null);
  const linhasRef = useRef<Linha[]>([]);
  const imagesRef = useRef<ImageObj[]>([]);
  const selStart = useRef<{ absX: number; absY: number; relX: number; relY: number; cssX: number; cssY: number } | null>(null);

  useEffect(() => { linhasRef.current = linhas; }, [linhas]);
  useEffect(() => { imagesRef.current = images; }, [images]);

  // 🔮 MESTRE: Carrega o estado das imagens salvo em nuvem ao iniciar
  useEffect(() => {
    if (!isMestre) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("canvas_state")
          .select("images, drawings")
          .eq("lobby_id", lobbyId)
          .maybeSingle();
        
        if (data) {
          if (data.images) setImages(data.images as ImageObj[]);
          if (data.drawings) setLinhas(data.drawings as Linha[]);
        }
      } catch {}
    })();
  }, [isMestre, lobbyId]);

  // 🔮 MESTRE: Salva os objetos de imagem na nuvem com debounce para evitar flood
  useEffect(() => {
    if (!isMestre) return;
    const t = setTimeout(async () => {
      try {
        await supabase
          .from("canvas_state")
          .upsert({
            lobby_id: lobbyId,
            images: images,
            drawings: linhasRef.current,
            ts: Date.now()
          });
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [images, isMestre, lobbyId]);

  const getCompositeDataUrl = useCallback(async () => {
    const cv = canvasRef.current;
    if (!cv) return "";
    const tmp = document.createElement("canvas");
    tmp.width = cv.width; tmp.height = cv.height;
    const ctx = tmp.getContext("2d");
    if (!ctx) return "";

    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, tmp.width, tmp.height);

    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width, sy = cv.height / rect.height;

    const drawImgs = async (isMap: boolean) => {
      const layerImgs = imagesRef.current.filter(i => isMap ? i.layer === "map" : i.layer !== "map");
      await Promise.all(layerImgs.map(img => new Promise<void>(resolve => {
        const el = new Image();
        el.onload = () => { ctx.drawImage(el, img.x * sx, img.y * sy, img.w * sx, img.h * sy); resolve(); };
        el.onerror = () => resolve();
        el.src = img.dataUrl;
      })));
    };

    await drawImgs(true);
    ctx.drawImage(cv, 0, 0);
    await drawImgs(false);

    return tmp.toDataURL("image/jpeg", 0.45); // Qualidade balanceada para tráfego rápido
  }, []);

  // 🔮 MESTRE: Loop de compressão e envio da lona composta para a nuvem
  useEffect(() => {
    if (!isMestre) return;
    const iv = setInterval(async () => {
      if (!canvasRef.current || !canvasOk.current) return;
      const now = Date.now(); if (now - lastSave.current < 3500) return;
      lastSave.current = now;
      try {
        const data = await getCompositeDataUrl();
        await supabase
          .from("canvas_state")
          .upsert({
            lobby_id: lobbyId,
            composite_url: data,
            drawings: linhasRef.current,
            images: imagesRef.current,
            ts: now
          });
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [isMestre, lobbyId, getCompositeDataUrl]);

  // 🔮 JOGADORES: Inscrição em Tempo Real (Realtime) para capturar a lona do mestre
  useEffect(() => {
    if (isMestre || tab !== "tela") return;

    const renderDataUrl = (dataUrl: string) => {
      const cv = canvasRef.current; if (!cv || !canvasOk.current) return;
      const img = new Image();
      img.onload = () => {
        const ctx = cv.getContext("2d"); if (!ctx) return;
        ctx.fillStyle = "#111827";
        ctx.fillRect(0, 0, cv.width, cv.height);

        const scale = Math.min(cv.width / img.width, cv.height / img.height);
        const w = img.width * scale, h = img.height * scale;
        const x = (cv.width - w) / 2, y = (cv.height - h) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height, x, y, w, h);
      };
      img.src = dataUrl;
    };

    // Carga inicial rápida
    (async () => {
      try {
        const { data } = await supabase
          .from("canvas_state")
          .select("composite_url")
          .eq("lobby_id", lobbyId)
          .maybeSingle();
        if (data?.composite_url) renderDataUrl(data.composite_url);
      } catch {}
    })();

    // Conectando antena de tempo real na tabela canvas_state
    const canal = supabase
      .channel(`canvas_sync:${lobbyId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "canvas_state", filter: `lobby_id=eq.${lobbyId}` },
        (payload) => {
          if (payload.new && payload.new.composite_url) {
            renderDataUrl(payload.new.composite_url);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [isMestre, tab, lobbyId]);

  // O ritual do ResizeObserver para a Arte dos Vetores
  useEffect(() => {
    if ((tab !== "mestre" && tab !== "tela") || !contRef.current) return;
    canvasOk.current = false;
    let timeoutId: any = null;

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
          const ctx = cv.getContext("2d"); if (!ctx) continue;

          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, cv.width, cv.height);

          const tracados = linhasRef.current || [];
          tracados.forEach(linha => {
            if (!linha || !linha.points || linha.points.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(linha.points[0].x * cv.width, linha.points[0].y * cv.height);
            for (let i = 1; i < linha.points.length; i++) {
              ctx.lineTo(linha.points[i].x * cv.width, linha.points[i].y * cv.height);
            }
            ctx.globalCompositeOperation = linha.tool === "eraser" ? "destination-out" : "source-over";
            ctx.strokeStyle = linha.tool === "eraser" ? "rgba(0,0,0,1)" : linha.color;
            ctx.lineWidth = linha.tool === "eraser" ? linha.brush * 5 : linha.brush;
            ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
            ctx.globalCompositeOperation = "source-over";
          });
          canvasOk.current = true;
        }
      }, 150);
    });

    ro.observe(contRef.current);
    return () => { ro.disconnect(); clearTimeout(timeoutId); };
  }, [tab]);

  // Invocação por Ctrl+V
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
              const max = 300; let w = img.width, h = img.height;
              if (w > max || h > max) {
                const ratio = Math.min(max / w, max / h);
                w *= ratio; h *= ratio;
              }
              const novaImagem: ImageObj = {
                id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                x: 50, y: 50, w: Math.round(w), h: Math.round(h),
                dataUrl: event.target.result, layer: "token"
              };
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

  const getP = (e: any) => {
    const cv = canvasRef.current, r = cv?.getBoundingClientRect();
    if (!cv || !r) return { absX: 0, absY: 0, relX: 0, relY: 0, cssX: 0, cssY: 0 };
    const s = e.touches ? e.touches[0] : e;
    return {
      absX: (s.clientX - r.left) * (cv.width / r.width),
      absY: (s.clientY - r.top) * (cv.height / r.height),
      relX: (s.clientX - r.left) / r.width,
      relY: (s.clientY - r.top) / r.height,
      cssX: s.clientX - r.left,
      cssY: s.clientY - r.top
    };
  };

  const onDown = (e: any) => {
    if (!isMestre) return;
    const p = getP(e);
    if (tool === "select") {
      if (e.target === canvasRef.current || e.target === contRef.current) {
        setSelImg([]); selStart.current = p;
        setSelBox({ x: p.cssX, y: p.cssY, w: 0, h: 0 });
      }
      return;
    }
    e.preventDefault(); drawing.current = true; lastP.current = p;
    linhaAtual.current = { tool, color, brush, points: [{ x: p.relX, y: p.relY }] };
  };

  const onMove = (e: any) => {
    if (!isMestre) return;
    const p = getP(e);
    if (tool === "select" && selBox && selStart.current) {
      const start = selStart.current;
      setSelBox({
        x: Math.min(start.cssX, p.cssX), y: Math.min(start.cssY, p.cssY),
        w: Math.abs(p.cssX - start.cssX), h: Math.abs(p.cssY - start.cssY)
      });
      return;
    }
    if (!drawing.current || tool === "select" || !linhaAtual.current || !canvasRef.current || !lastP.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d"); if (!ctx) return;
    linhaAtual.current.points.push({ x: p.relX, y: p.relY });

    ctx.beginPath(); ctx.moveTo(lastP.current.absX, lastP.current.absY); ctx.lineTo(p.absX, p.absY);
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = tool === "eraser" ? "rgba(0,0,0,1)" : color;
    ctx.lineWidth = tool === "eraser" ? brush * 5 : brush;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    lastP.current = p;
  };

  const onUp = () => {
    if (tool === "select" && selBox) {
      const capturados = imagesRef.current.filter(img => {
        return (
          img.x < selBox.x + selBox.w && img.x + img.w > selBox.x &&
          img.y < selBox.y + selBox.h && img.y + img.h > selBox.y
        );
      }).map(i => i.id);
      if (capturados.length > 0) setSelImg(capturados);
      setSelBox(null); selStart.current = null;
    }
    if (drawing.current && linhaAtual.current) {
      const novaLista = [...linhas, linhaAtual.current];
      linhasRef.current = novaLista; setLinhas(novaLista);
      linhaAtual.current = null;
    }
    drawing.current = false;
  };

  const clearCv = async () => {
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    setImages([]); setSelImg([]); setLinhas([]);
    linhasRef.current = [];
    try {
      await supabase
        .from("canvas_state")
        .upsert({ lobby_id: lobbyId, drawings: [], images: [], composite_url: "", ts: Date.now() });
    } catch {}
  };

  const loadImg = (e: any) => {
    const f = e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = (ev: any) => {
      const dataUrl = ev.target.result;
      const el = new Image();
      el.onload = () => {
        const cv = canvasRef.current; if (!cv) return;
        const rect = cv.getBoundingClientRect();
        const maxW = rect.width * 0.65, maxH = rect.height * 0.65;
        const scale = Math.min(maxW / el.width, maxH / el.height, 1);
        const w = el.width * scale, h = el.height * scale;
        const x = (rect.width - w) / 2, y = (rect.height - h) / 2;
        const id = mkId();
        setImages(p => [...p, { id, dataUrl, x, y, w, h, layer: "token" }]);
        setTool("select"); setSelImg([id]);
      };
      el.src = dataUrl;
    };
    fr.readAsDataURL(f); e.target.value = "";
  };

  return {
    tool, setTool, color, setColor, brush, setBrush,
    linhas, setLinhas, images, setImages, selImg, setSelImg, selBox,
    canvasRef, contRef, fileRef, clearCv, loadImg, onDown, onMove, onUp
  };
}