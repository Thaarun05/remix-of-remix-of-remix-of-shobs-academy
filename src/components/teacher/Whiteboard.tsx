import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  Save,
  ZoomIn,
  ZoomOut,
  Type,
  Share2,
  Loader2,
  FolderOpen,
  Copy,
  Check,
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
  const [textMode, setTextMode] = useState(false);

  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const canvasWidth = 1400;
  const canvasHeight = 900;

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawGrid(ctx);
    saveToHistory();
  }, []);

  // Load saved boards
  useEffect(() => {
    if (user) fetchSavedBoards();
  }, [user]);

  const fetchSavedBoards = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("whiteboards")
      .select("id, title, image_data, created_at, updated_at, share_token")
      .eq("teacher_user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    setSavedBoards((data as WhiteboardRecord[]) || []);
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = "#e8edf2";
    ctx.lineWidth = 0.5;
    const gridSize = 25;
    for (let x = 0; x <= canvasWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y <= canvasHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ imageData });
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(history[newIndex].imageData, 0, 0);
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(history[newIndex].imageData, 0, 0);
    setHistoryIndex(newIndex);
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawGrid(ctx);
    saveToHistory();
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
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
        saveToHistory();
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
      saveToHistory();
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
        const { error } = await supabase
          .from("whiteboards")
          .update({ title, image_data: imageData, updated_at: new Date().toISOString() })
          .eq("id", currentBoardId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("whiteboards")
          .insert({ teacher_user_id: user.id, title, image_data: imageData })
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
      const { data, error } = await supabase
        .from("whiteboards")
        .select("*")
        .eq("id", boardId)
        .single();
      if (error) throw error;
      const board = data as WhiteboardRecord;

      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0);
        saveToHistory();
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
      toast({ title: "Save first", description: "Please save the whiteboard before sharing.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("whiteboards")
      .select("share_token")
      .eq("id", currentBoardId)
      .single();
    if (error || !data) return;
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
    clearCanvas();
    setHistory([]);
    setHistoryIndex(-1);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      drawGrid(ctx);
      saveToHistory();
    }
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const zoomOut = () => setZoom((z) => Math.max(z - 25, 25));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold max-w-xs"
            placeholder="Whiteboard title..."
          />
          <Button variant="teacher" size="sm" onClick={saveToDatabase} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={newBoard}>
            New
          </Button>
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
                  <SelectItem key={b.id} value={b.id}>
                    {b.title}
                  </SelectItem>
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
            {/* Tools */}
            <div className="flex items-center gap-1 border-r pr-3 border-border">
              <Button
                variant={tool === "brush" ? "teacher" : "ghost"}
                size="icon"
                onClick={() => setTool("brush")}
                title="Brush"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant={tool === "eraser" ? "teacher" : "ghost"}
                size="icon"
                onClick={() => setTool("eraser")}
                title="Eraser"
              >
                <Eraser className="h-4 w-4" />
              </Button>
              <Button
                variant={tool === "text" ? "teacher" : "ghost"}
                size="icon"
                onClick={() => setTool("text")}
                title="Text"
              >
                <Type className="h-4 w-4" />
              </Button>
            </div>

            {/* Colors */}
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

            {/* Brush Size */}
            <div className="flex items-center gap-2 border-r pr-3 border-border min-w-[140px]">
              <Label className="text-xs whitespace-nowrap">Size</Label>
              <Slider
                value={[brushSize]}
                onValueChange={([v]) => setBrushSize(v)}
                min={1}
                max={20}
                step={1}
                className="w-20"
              />
              <span className="text-xs text-muted-foreground w-6 text-right">{brushSize}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 border-r pr-3 border-border">
              <Button variant="ghost" size="icon" onClick={undo} disabled={historyIndex <= 0} title="Undo">
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo">
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={clearCanvas} title="Clear All">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-1 border-r pr-3 border-border">
              <Button variant="ghost" size="icon" onClick={zoomOut} disabled={zoom <= 25} title="Zoom Out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium w-10 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" onClick={zoomIn} disabled={zoom >= 200} title="Zoom In">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Download */}
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
        className="relative overflow-auto rounded-xl border border-border bg-muted/30 shadow-inner"
        style={{ maxHeight: "calc(100vh - 320px)" }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-teacher" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="block"
          style={{
            width: `${(canvasWidth * zoom) / 100}px`,
            height: `${(canvasHeight * zoom) / 100}px`,
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
