import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil, Eraser, Undo2, Redo2, Trash2, Download, Save,
  ZoomIn, ZoomOut, Type, Share2, Loader2, FolderOpen, Copy, Check,
  Move, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "brush" | "eraser" | "text" | "pan";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  tool: "brush" | "eraser";
}

interface TextItem {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
}

interface WhiteboardState {
  strokes: Stroke[];
  texts: TextItem[];
}

interface WhiteboardRecord {
  id: string;
  title: string;
  image_data: string;
  created_at: string;
  updated_at: string;
  share_token: string | null;
}

const COLORS = [
  { name: "Black", value: "#1a1a2e" },
  { name: "Red", value: "#e74c3c" },
  { name: "Blue", value: "#2980b9" },
  { name: "Green", value: "#27ae60" },
  { name: "Orange", value: "#f39c12" },
  { name: "Purple", value: "#8e44ad" },
];

const MAX_HISTORY = 20;
const GRID_SIZE = 25;

const wb = () => supabase.from("whiteboards" as any);

export function Whiteboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(3);
  const [zoom, setZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [title, setTitle] = useState("Untitled Whiteboard");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedBoards, setSavedBoards] = useState<WhiteboardRecord[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Infinite canvas state
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panStart = useRef<Point | null>(null);
  const panOffsetStart = useRef<Point>({ x: 0, y: 0 });

  // Drawing data stored as vector data
  const stateRef = useRef<WhiteboardState>({ strokes: [], texts: [] });
  const currentStroke = useRef<Stroke | null>(null);

  // History for undo/redo
  const historyRef = useRef<WhiteboardState[]>([]);
  const historyIdxRef = useRef(-1);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [historyLen, setHistoryLen] = useState(0);

  const pushHistory = useCallback(() => {
    const snapshot = JSON.parse(JSON.stringify(stateRef.current));
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
    setHistoryIndex(historyIdxRef.current);
    setHistoryLen(historyRef.current.length);
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    stateRef.current = JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current]));
    setHistoryIndex(historyIdxRef.current);
    render();
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    stateRef.current = JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current]));
    setHistoryIndex(historyIdxRef.current);
    render();
  }, []);

  // Convert screen coords to world coords
  const screenToWorld = useCallback((sx: number, sy: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (sx - rect.left) / zoomRef.current - offsetRef.current.x;
    const y = (sy - rect.top) / zoomRef.current - offsetRef.current.y;
    return { x, y };
  }, []);

  const getEventPos = (e: React.MouseEvent | React.TouchEvent): { sx: number; sy: number } => {
    if ("touches" in e && e.touches.length > 0) {
      return { sx: e.touches[0].clientX, sy: e.touches[0].clientY };
    }
    if ("clientX" in e) {
      return { sx: (e as React.MouseEvent).clientX, sy: (e as React.MouseEvent).clientY };
    }
    return { sx: 0, sy: 0 };
  };

  // Render the infinite canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const z = zoomRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;

    // Clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Apply transform
    ctx.setTransform(z, 0, 0, z, ox * z, oy * z);

    // Draw infinite grid
    ctx.save();
    ctx.strokeStyle = "#e8edf2";
    ctx.lineWidth = 0.5 / z;
    const startX = Math.floor(-ox / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const startY = Math.floor(-oy / GRID_SIZE) * GRID_SIZE - GRID_SIZE;
    const endX = startX + w / z + GRID_SIZE * 2;
    const endY = startY + h / z + GRID_SIZE * 2;

    for (let x = startX; x <= endX; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }
    ctx.restore();

    // Draw strokes
    const { strokes, texts } = stateRef.current;
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
      ctx.lineWidth = stroke.tool === "eraser" ? stroke.size * 4 : stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Draw current stroke in progress
    if (currentStroke.current && currentStroke.current.points.length >= 2) {
      const s = currentStroke.current;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : s.color;
      ctx.lineWidth = s.tool === "eraser" ? s.size * 4 : s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Draw texts
    for (const t of texts) {
      ctx.font = `${t.size * 5 + 12}px 'Inter', sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }

    // Reset transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, []);

  // Resize canvas to container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    // Adjust render to use CSS size
    canvas.width = rect.width;
    canvas.height = rect.height;
    render();
  }, [render]);

  useEffect(() => {
    resizeCanvas();
    pushHistory();
    const handler = () => resizeCanvas();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (user) fetchSavedBoards();
  }, [user]);

  // Wheel zoom centered on cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const oldZoom = zoomRef.current;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(oldZoom * delta, 0.1), 10);

      // Adjust offset so zoom centers on cursor
      const worldX = mx / oldZoom - offsetRef.current.x;
      const worldY = my / oldZoom - offsetRef.current.y;
      const newOx = mx / newZoom - worldX;
      const newOy = my / newZoom - worldY;

      zoomRef.current = newZoom;
      offsetRef.current = { x: newOx, y: newOy };
      setZoom(newZoom);
      setOffset({ x: newOx, y: newOy });
      render();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [render]);

  const fetchSavedBoards = async () => {
    if (!user) return;
    const { data } = await wb()
      .select("id, title, image_data, created_at, updated_at, share_token")
      .eq("teacher_user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    setSavedBoards((data as unknown as WhiteboardRecord[]) || []);
  };

  const clearCanvas = () => {
    stateRef.current = { strokes: [], texts: [] };
    pushHistory();
    render();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const { sx, sy } = getEventPos(e);

    if (tool === "pan" || (e as React.MouseEvent).button === 1) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: sx, y: sy };
      panOffsetStart.current = { ...offsetRef.current };
      return;
    }

    if (tool === "text") {
      const pos = screenToWorld(sx, sy);
      const text = prompt("Enter text:");
      if (text) {
        stateRef.current.texts.push({ x: pos.x, y: pos.y, text, color, size: brushSize });
        pushHistory();
        render();
      }
      return;
    }

    e.preventDefault();
    setIsDrawing(true);
    const pos = screenToWorld(sx, sy);
    currentStroke.current = {
      points: [pos],
      color,
      size: brushSize,
      tool: tool === "eraser" ? "eraser" : "brush",
    };
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    const { sx, sy } = getEventPos(e);

    if (isPanning && panStart.current) {
      e.preventDefault();
      const dx = (sx - panStart.current.x) / zoomRef.current;
      const dy = (sy - panStart.current.y) / zoomRef.current;
      offsetRef.current = {
        x: panOffsetStart.current.x + dx,
        y: panOffsetStart.current.y + dy,
      };
      setOffset({ ...offsetRef.current });
      render();
      return;
    }

    if (!isDrawing || !currentStroke.current) return;
    e.preventDefault();
    const pos = screenToWorld(sx, sy);
    currentStroke.current.points.push(pos);
    render();
  };

  const stopDrawing = () => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      return;
    }
    if (isDrawing && currentStroke.current) {
      stateRef.current.strokes.push(currentStroke.current);
      currentStroke.current = null;
      setIsDrawing(false);
      pushHistory();
      render();
    }
  };

  const changeZoom = (direction: "in" | "out") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const oldZoom = zoomRef.current;
    const newZoom = direction === "in"
      ? Math.min(oldZoom * 1.25, 10)
      : Math.max(oldZoom / 1.25, 0.1);

    const worldX = cx / oldZoom - offsetRef.current.x;
    const worldY = cy / oldZoom - offsetRef.current.y;
    const newOx = cx / newZoom - worldX;
    const newOy = cy / newZoom - worldY;

    zoomRef.current = newZoom;
    offsetRef.current = { x: newOx, y: newOy };
    setZoom(newZoom);
    setOffset({ x: newOx, y: newOy });
    render();
  };

  const resetView = () => {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    render();
  };

  const saveToPNG = () => {
    // Render to an offscreen canvas with all content
    const { strokes, texts } = stateRef.current;
    if (strokes.length === 0 && texts.length === 0) {
      toast({ title: "Empty", description: "Nothing to export.", variant: "destructive" });
      return;
    }

    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of strokes) {
      for (const p of s.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    for (const t of texts) {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + 200);
      maxY = Math.max(maxY, t.y + 30);
    }

    const pad = 50;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const w = Math.max(maxX - minX, 400);
    const h = Math.max(maxY - minY, 300);

    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.translate(-minX, -minY);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      ctx.strokeStyle = stroke.tool === "eraser" ? "#ffffff" : stroke.color;
      ctx.lineWidth = stroke.tool === "eraser" ? stroke.size * 4 : stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    for (const t of texts) {
      ctx.font = `${t.size * 5 + 12}px 'Inter', sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }

    const link = document.createElement("a");
    link.download = `${title}.png`;
    link.href = offscreen.toDataURL("image/png");
    link.click();
  };

  const saveToDatabase = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Save vector data as JSON, plus a thumbnail
      const canvas = canvasRef.current;
      const imageData = canvas ? canvas.toDataURL("image/png") : "";
      const payload = {
        title,
        image_data: JSON.stringify(stateRef.current),
        updated_at: new Date().toISOString(),
      };

      if (currentBoardId) {
        const { error } = await wb().update(payload as any).eq("id", currentBoardId);
        if (error) throw error;
      } else {
        const { data, error } = await wb()
          .insert({ teacher_user_id: user.id, ...payload } as any)
          .select("id")
          .single();
        if (error) throw error;
        setCurrentBoardId((data as any).id);
      }
      toast({ title: "Saved", description: "Whiteboard saved successfully." });
      fetchSavedBoards();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const loadBoard = async (boardId: string) => {
    setLoading(true);
    try {
      const { data, error } = await wb().select("*").eq("id", boardId).single();
      if (error) throw error;
      const board = data as unknown as WhiteboardRecord;

      // Try parsing as vector JSON, fall back to legacy image
      try {
        const parsed = JSON.parse(board.image_data) as WhiteboardState;
        stateRef.current = parsed;
      } catch {
        // Legacy base64 image — start fresh but notify
        stateRef.current = { strokes: [], texts: [] };
        toast({ title: "Legacy board", description: "Old format loaded as empty. Drawings were not vector-based." });
      }

      setTitle(board.title);
      setCurrentBoardId(board.id);
      setShareLink(board.share_token ? `${window.location.origin}/whiteboard?token=${board.share_token}` : null);
      resetView();
      pushHistory();
      render();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateShareLink = async () => {
    if (!currentBoardId) {
      toast({ title: "Save first", description: "Please save before sharing.", variant: "destructive" });
      return;
    }
    const { data } = await wb().select("share_token").eq("id", currentBoardId).single();
    if (!data) return;
    const link = `${window.location.origin}/whiteboard?token=${(data as any).share_token}`;
    setShareLink(link);
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied!", description: "Share this read-only link with students." });
  };

  const newBoard = () => {
    setCurrentBoardId(null);
    setTitle("Untitled Whiteboard");
    setShareLink(null);
    stateRef.current = { strokes: [], texts: [] };
    historyRef.current = [];
    historyIdxRef.current = -1;
    setHistoryIndex(-1);
    setHistoryLen(0);
    resetView();
    pushHistory();
    render();
  };

  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold max-w-xs" placeholder="Whiteboard title..." />
          <Button variant="teacher" size="sm" onClick={saveToDatabase} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={newBoard}>New</Button>
        </div>
        <div className="flex items-center gap-2">
          {savedBoards.length > 0 && (
            <Select onValueChange={loadBoard}>
              <SelectTrigger className="w-[200px]">
                <FolderOpen className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Load board..." />
              </SelectTrigger>
              <SelectContent>
                {savedBoards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={generateShareLink}>
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            Share
          </Button>
        </div>
      </div>

      {shareLink && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm">
          <span className="truncate flex-1 font-mono text-xs">{shareLink}</span>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 border-r pr-3 border-border">
              <Button variant={tool === "brush" ? "teacher" : "ghost"} size="icon" onClick={() => setTool("brush")} title="Brush">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant={tool === "eraser" ? "teacher" : "ghost"} size="icon" onClick={() => setTool("eraser")} title="Eraser">
                <Eraser className="h-4 w-4" />
              </Button>
              <Button variant={tool === "text" ? "teacher" : "ghost"} size="icon" onClick={() => setTool("text")} title="Text">
                <Type className="h-4 w-4" />
              </Button>
              <Button variant={tool === "pan" ? "teacher" : "ghost"} size="icon" onClick={() => setTool("pan")} title="Pan">
                <Move className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 border-r pr-3 border-border">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  className={cn(
                    "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                    color === c.value ? "border-teacher ring-2 ring-teacher/30 scale-110" : "border-border"
                  )}
                  style={{ backgroundColor: c.value }}
                  onClick={() => setColor(c.value)}
                  title={c.name}
                />
              ))}
            </div>

            <div className="flex items-center gap-2 border-r pr-3 border-border min-w-[140px]">
              <Label className="text-xs whitespace-nowrap">Size</Label>
              <Slider value={[brushSize]} onValueChange={([v]) => setBrushSize(v)} min={1} max={20} step={1} className="w-20" />
              <span className="text-xs text-muted-foreground w-6 text-right">{brushSize}</span>
            </div>

            <div className="flex items-center gap-1 border-r pr-3 border-border">
              <Button variant="ghost" size="icon" onClick={undo} disabled={historyIdxRef.current <= 0} title="Undo">
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={redo} disabled={historyIdxRef.current >= historyRef.current.length - 1} title="Redo">
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={clearCanvas} title="Clear All">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 border-r pr-3 border-border">
              <Button variant="ghost" size="icon" onClick={() => changeZoom("out")} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium w-10 text-center">{zoomPercent}%</span>
              <Button variant="ghost" size="icon" onClick={() => changeZoom("in")} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={resetView} title="Reset View">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={saveToPNG}>
              <Download className="h-4 w-4" />
              PNG
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 rounded-xl border border-border bg-muted/30 shadow-inner overflow-hidden"
        style={{ minHeight: "500px" }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-teacher" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="block w-full h-full"
          style={{
            cursor: tool === "pan" ? (isPanning ? "grabbing" : "grab") : tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair",
            touchAction: "none",
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}
