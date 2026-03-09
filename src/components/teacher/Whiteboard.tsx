import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = "brush" | "eraser" | "text";

interface HistoryEntry {
  imageData: ImageData;
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
const CANVAS_W = 1400;
const CANVAS_H = 900;

// Helper to query the whiteboards table (not yet in generated types)
const wb = () => supabase.from("whiteboards" as any);

export function Whiteboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("brush");
  const [color, setColor] = useState(COLORS[0].value);
  const [brushSize, setBrushSize] = useState(3);
  const [zoom, setZoom] = useState(100);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [title, setTitle] = useState("Untitled Whiteboard");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedBoards, setSavedBoards] = useState<WhiteboardRecord[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = "#e8edf2";
    ctx.lineWidth = 0.5;
    const g = 25;
    for (let x = 0; x <= CANVAS_W; x += g) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += g) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
    }
    ctx.restore();
  };

  const saveToHistory = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    setHistory(prev => {
      const newH = prev.slice(0, historyIndex + 1);
      newH.push({ imageData });
      if (newH.length > MAX_HISTORY) newH.shift();
      return newH;
    });
    setHistoryIndex(prev => {
      const newH = history.slice(0, prev + 1);
      return Math.min(newH.length, MAX_HISTORY - 1);
    });
  };

  // Use a ref-based history for reliable undo/redo
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIdxRef = useRef(-1);

  const pushHistory = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push({ imageData });
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
    setHistoryIndex(historyIdxRef.current);
    setHistory([...historyRef.current]);
  };

  const undo = () => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(historyRef.current[historyIdxRef.current].imageData, 0, 0);
    setHistoryIndex(historyIdxRef.current);
  };

  const redo = () => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(historyRef.current[historyIdxRef.current].imageData, 0, 0);
    setHistoryIndex(historyIdxRef.current);
  };

  const initCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx);
    pushHistory();
  };

  useEffect(() => { initCanvas(); }, []);
  useEffect(() => { if (user) fetchSavedBoards(); }, [user]);

  const fetchSavedBoards = async () => {
    if (!user) return;
    const { data } = await wb()
      .select("id, title, image_data, created_at, updated_at, share_token")
      .eq("teacher_user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    setSavedBoards((data as unknown as WhiteboardRecord[]) || []);
  };

  const clearCanvas = () => { initCanvas(); };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = CANVAS_W / rect.width;
    const sy = CANVAS_H / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === "text") {
      const pos = getCanvasPos(e);
      const text = prompt("Enter text:");
      if (text) {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        ctx.font = `${brushSize * 5 + 12}px 'Inter', sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(text, pos.x, pos.y);
        pushHistory();
      }
      return;
    }
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = getCanvasPos(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = tool === "eraser" ? brushSize * 4 : brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      lastPos.current = null;
      pushHistory();
    }
  };

  const saveToPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const saveToDatabase = async () => {
    if (!user) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const imageData = canvas.toDataURL("image/png");
      if (currentBoardId) {
        const { error } = await wb()
          .update({ title, image_data: imageData, updated_at: new Date().toISOString() } as any)
          .eq("id", currentBoardId);
        if (error) throw error;
      } else {
        const { data, error } = await wb()
          .insert({ teacher_user_id: user.id, title, image_data: imageData } as any)
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
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0);
        pushHistory();
        setTitle(board.title);
        setCurrentBoardId(board.id);
        setShareLink(board.share_token ? `${window.location.origin}/whiteboard?token=${board.share_token}` : null);
        setLoading(false);
      };
      img.src = board.image_data;
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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
    historyRef.current = [];
    historyIdxRef.current = -1;
    setHistory([]);
    setHistoryIndex(-1);
    initCanvas();
  };

  return (
    <div className="space-y-4">
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
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(z - 25, 25))} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium w-10 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(z + 25, 200))} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
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
      <div ref={containerRef} className="relative overflow-auto rounded-xl border border-border bg-muted/30 shadow-inner" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-teacher" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="block"
          style={{
            width: `${(CANVAS_W * zoom) / 100}px`,
            height: `${(CANVAS_H * zoom) / 100}px`,
            cursor: tool === "text" ? "text" : tool === "eraser" ? "cell" : "crosshair",
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
