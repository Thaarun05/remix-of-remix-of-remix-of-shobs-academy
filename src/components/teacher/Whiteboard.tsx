import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil, Eraser, Undo2, Redo2, Trash2, Download, Save,
  Type, Share2, Loader2, FolderOpen, Copy, Check,
  RotateCcw, Minus, Square, Circle as CircleIcon, Send,
  Maximize, Minimize, MousePointer2, ArrowUpRight, Spline,
  StickyNote, MessageCircle, Hash, Table2, ImagePlus, MoreHorizontal,
  Sigma, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Tool = "pointer" | "pen" | "eraser" | "line" | "rect" | "circle" | "arrow" | "connector" | "text" | "equation" | "sticky" | "comment" | "frame" | "table" | "image";

interface Point { x: number; y: number; }

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  tool: "pen" | "eraser";
}

interface ShapeItem {
  type: "line" | "rect" | "circle" | "arrow";
  start: Point;
  end: Point;
  color: string;
  size: number;
}

interface TextItem {
  x: number; y: number;
  text: string;
  color: string;
  size: number;
}

interface WhiteboardState {
  strokes: Stroke[];
  shapes: ShapeItem[];
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

interface StudentItem {
  user_id: string;
  student_name: string;
}

const COLORS = [
  "#1a1a2e", "#e74c3c", "#2980b9", "#27ae60",
  "#f39c12", "#8e44ad", "#e91e63", "#00bcd4",
  "#ff5722", "#795548", "#607d8b", "#9c27b0",
];

const STROKE_SIZES = [2, 4, 6, 10, 16];

const MAX_HISTORY = 40;
const CANVAS_W = 2400;
const CANVAS_H = 1600;
const GRID_SIZE = 25;

const wb = () => supabase.from("whiteboards" as any);

export function Whiteboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [customColor, setCustomColor] = useState("#000000");
  const [strokeSize, setStrokeSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [title, setTitle] = useState("Untitled Whiteboard");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedBoards, setSavedBoards] = useState<WhiteboardRecord[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Text tool
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [textValue, setTextValue] = useState("");

  // Send to students modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // State
  const stateRef = useRef<WhiteboardState>({ strokes: [], shapes: [], texts: [] });
  const currentStroke = useRef<Stroke | null>(null);
  const shapeStart = useRef<Point | null>(null);
  const shapePreview = useRef<Point | null>(null);

  // History
  const historyRef = useRef<WhiteboardState[]>([]);
  const historyIdxRef = useRef(-1);
  const [, forceUpdate] = useState(0);

  const pushHistory = useCallback(() => {
    const snapshot = JSON.parse(JSON.stringify(stateRef.current));
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
    forceUpdate(n => n + 1);
  }, []);

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    stateRef.current = JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current]));
    forceUpdate(n => n + 1);
    render();
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    stateRef.current = JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current]));
    forceUpdate(n => n + 1);
    render();
  }, []);

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = "#e8edf2";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= CANVAS_W; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawShape = (ctx: CanvasRenderingContext2D, shape: ShapeItem) => {
    ctx.save();
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (shape.type === "line" || shape.type === "arrow") {
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.lineTo(shape.end.x, shape.end.y);
      ctx.stroke();
      if (shape.type === "arrow") {
        const angle = Math.atan2(shape.end.y - shape.start.y, shape.end.x - shape.start.x);
        const headLen = Math.max(shape.size * 3, 12);
        ctx.beginPath();
        ctx.moveTo(shape.end.x, shape.end.y);
        ctx.lineTo(shape.end.x - headLen * Math.cos(angle - Math.PI / 6), shape.end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(shape.end.x, shape.end.y);
        ctx.lineTo(shape.end.x - headLen * Math.cos(angle + Math.PI / 6), shape.end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    } else if (shape.type === "rect") {
      const w = shape.end.x - shape.start.x;
      const h = shape.end.y - shape.start.y;
      ctx.strokeRect(shape.start.x, shape.start.y, w, h);
    } else if (shape.type === "circle") {
      const rx = Math.abs(shape.end.x - shape.start.x) / 2;
      const ry = Math.abs(shape.end.y - shape.start.y) / 2;
      const cx = (shape.start.x + shape.end.x) / 2;
      const cy = (shape.start.y + shape.end.y) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx);

    const { strokes, shapes, texts } = stateRef.current;

    // Draw strokes
    for (const s of strokes) {
      if (s.points.length < 2) continue;
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

    // Draw shapes
    for (const shape of shapes) {
      drawShape(ctx, shape);
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

    // Draw shape preview
    if (shapeStart.current && shapePreview.current && (tool === "line" || tool === "rect" || tool === "circle" || tool === "arrow")) {
      drawShape(ctx, {
        type: tool as "line" | "rect" | "circle" | "arrow",
        start: shapeStart.current,
        end: shapePreview.current,
        color,
        size: strokeSize,
      });
    }

    // Draw texts
    for (const t of texts) {
      ctx.font = `${t.size * 4 + 14}px 'Inter', sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
  }, [tool, color, strokeSize]);

  useEffect(() => {
    render();
    pushHistory();
  }, []);

  useEffect(() => {
    if (user) fetchSavedBoards();
  }, [user]);

  const fetchSavedBoards = async () => {
    if (!user) return;
    const { data } = await wb()
      .select("id, title, image_data, created_at, updated_at, share_token")
      .eq("teacher_user_id", user.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    setSavedBoards((data as unknown as WhiteboardRecord[]) || []);
  };

  const fetchStudents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("student_profiles")
      .select("user_id, student_name")
      .eq("assigned_teacher_id", user.id)
      .order("student_name");
    setStudents(data || []);
  };

  const clearCanvas = () => {
    stateRef.current = { strokes: [], shapes: [], texts: [] };
    pushHistory();
    render();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);

    if (tool === "text") {
      // Place text input at click position
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
      }
      setTextInput({
        x: clientX - rect.left,
        y: clientY - rect.top,
        visible: true,
      });
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    if (tool === "line" || tool === "rect" || tool === "circle" || tool === "arrow") {
      e.preventDefault();
      shapeStart.current = pos;
      shapePreview.current = pos;
      setIsDrawing(true);
      return;
    }

    // pen or eraser
    e.preventDefault();
    setIsDrawing(true);
    currentStroke.current = {
      points: [pos],
      color,
      size: strokeSize,
      tool: tool === "eraser" ? "eraser" : "pen",
    };
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);

    if ((tool === "line" || tool === "rect" || tool === "circle" || tool === "arrow") && shapeStart.current) {
      shapePreview.current = pos;
      render();
      return;
    }

    if (currentStroke.current) {
      currentStroke.current.points.push(pos);
      render();
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    if ((tool === "line" || tool === "rect" || tool === "circle" || tool === "arrow") && shapeStart.current && shapePreview.current) {
      stateRef.current.shapes.push({
        type: tool as "line" | "rect" | "circle" | "arrow",
        start: shapeStart.current,
        end: shapePreview.current,
        color,
        size: strokeSize,
      });
      shapeStart.current = null;
      shapePreview.current = null;
      setIsDrawing(false);
      pushHistory();
      render();
      return;
    }

    if (currentStroke.current) {
      stateRef.current.strokes.push(currentStroke.current);
      currentStroke.current = null;
      setIsDrawing(false);
      pushHistory();
      render();
    }
  };

  const commitText = () => {
    if (!textValue.trim()) {
      setTextInput({ ...textInput, visible: false });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    stateRef.current.texts.push({
      x: textInput.x * scaleX,
      y: textInput.y * scaleY,
      text: textValue,
      color,
      size: strokeSize,
    });
    setTextInput({ ...textInput, visible: false });
    setTextValue("");
    pushHistory();
    render();
  };

  const handleDoubleClick = () => {
    setIsFullscreen(prev => !prev);
  };

  const saveToPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    render();
    const link = document.createElement("a");
    link.download = `${title}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const saveToDatabase = async () => {
    if (!user) return;
    setSaving(true);
    try {
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

      try {
        const parsed = JSON.parse(board.image_data);
        stateRef.current = {
          strokes: parsed.strokes || [],
          shapes: parsed.shapes || [],
          texts: parsed.texts || [],
        };
      } catch {
        stateRef.current = { strokes: [], shapes: [], texts: [] };
        toast({ title: "Legacy board", description: "Old format loaded as empty." });
      }

      setTitle(board.title);
      setCurrentBoardId(board.id);
      setShareLink(board.share_token ? `${window.location.origin}/whiteboard?token=${board.share_token}` : null);
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
    stateRef.current = { strokes: [], shapes: [], texts: [] };
    historyRef.current = [];
    historyIdxRef.current = -1;
    forceUpdate(n => n + 1);
    pushHistory();
    render();
  };

  const openSendModal = () => {
    fetchStudents();
    setSelectedStudents(new Set());
    setSendModalOpen(true);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map(s => s.user_id)));
    }
  };

  const sendToStudents = async () => {
    if (!user || selectedStudents.size === 0) return;
    setSending(true);
    try {
      // Save the board first if needed
      if (!currentBoardId) await saveToDatabase();

      // Create notifications for each selected student
      const notifications = Array.from(selectedStudents).map(studentId => ({
        recipient_id: studentId,
        sender_id: user.id,
        type: "whiteboard_shared",
        title: "New Whiteboard Shared",
        body: `Your teacher shared a whiteboard: "${title}"`,
        entity_id: currentBoardId,
        entity_table: "whiteboards",
        role_target: "student",
      }));

      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;

      toast({ title: "✅ Whiteboard shared!", description: "Students will see it in their dashboard." });
      setTimeout(() => setSendModalOpen(false), 2000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Generate thumbnail for send modal
  const getThumbnail = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;

  const tools: { id: Tool; icon: React.ElementType; label: string }[] = [
    { id: "pen", icon: Pencil, label: "Pen" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: CircleIcon, label: "Circle" },
    { id: "text", icon: Type, label: "Text" },
  ];

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[9999] bg-background flex flex-col"
    : "space-y-3 h-full flex flex-col";

  return (
    <div className={containerClasses}>
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 pt-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold max-w-[200px]"
            placeholder="Whiteboard title..."
          />
          <Button variant="teacher" size="sm" onClick={saveToDatabase} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" size="sm" onClick={newBoard}>New</Button>
          {savedBoards.length > 0 && (
            <select
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm"
              onChange={(e) => e.target.value && loadBoard(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Load board...</option>
              {savedBoards.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Undo/Redo/Clear/Download */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} title="Undo">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} title="Redo">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={clearCanvas} title="Clear Board">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={saveToPNG}>
              <Download className="h-4 w-4" />
              PNG
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={generateShareLink}>
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            Share Link
          </Button>

          <Button variant="teacher" size="sm" onClick={openSendModal}>
            <Send className="h-4 w-4" />
            📤 Send to Students
          </Button>

          {isFullscreen && (
            <span className="px-2 py-1 rounded-full bg-teacher/10 text-teacher text-xs font-bold">FULLSCREEN</span>
          )}
        </div>
      </div>

      {shareLink && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm mx-3">
          <span className="truncate flex-1 font-mono text-xs">{shareLink}</span>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(shareLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">Double-click canvas to enter/exit fullscreen</p>

      {/* Main area: left tools | canvas | right colors */}
      <div className="flex flex-1 gap-2 px-3 pb-3 min-h-0">
        {/* Left Toolbar */}
        <div className="flex flex-col gap-2 py-2">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                tool === t.id
                  ? "bg-teacher/10 border-2 border-teacher text-teacher shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
              )}
              title={t.label}
            >
              <t.icon className="h-5 w-5" />
            </button>
          ))}

          <div className="border-t border-border my-1" />

          {/* 5 stroke sizes */}
          {STROKE_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setStrokeSize(s)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                strokeSize === s
                  ? "bg-teacher/10 border-2 border-teacher"
                  : "bg-card border border-border hover:bg-muted"
              )}
              title={`Size ${s}`}
            >
              <span
                className="rounded-full bg-foreground"
                style={{ width: Math.min(s * 1.5, 20), height: Math.min(s * 1.5, 20) }}
              />
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="relative flex-1 rounded-xl border border-border bg-muted/30 shadow-inner overflow-auto"
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-teacher" />
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block max-w-full h-auto"
            style={{
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
            onDoubleClick={handleDoubleClick}
          />

          {/* Floating text input */}
          {textInput.visible && (
            <input
              ref={textInputRef}
              className="absolute bg-transparent border-b-2 border-teacher text-foreground outline-none px-1 py-0.5 text-sm"
              style={{ left: textInput.x, top: textInput.y - 10, minWidth: 120 }}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput({ ...textInput, visible: false }); }}
              onBlur={commitText}
              placeholder="Type and press Enter"
            />
          )}
        </div>

        {/* Right Color Sidebar */}
        <div className="flex flex-col gap-1.5 py-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-transform hover:scale-110",
                color === c ? "ring-2 ring-teacher ring-offset-2 ring-offset-background scale-110 border-teacher" : "border-border"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="border-t border-border my-1" />
          <label className="w-8 h-8 rounded-full border-2 border-border overflow-hidden cursor-pointer hover:scale-110 transition-transform relative" title="Custom color">
            <input
              type="color"
              value={customColor}
              onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <span
              className="block w-full h-full rounded-full"
              style={{
                background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)`,
              }}
            />
          </label>
        </div>
      </div>

      {/* Send to Students Modal */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>📤 Send Whiteboard to Students</DialogTitle>
          </DialogHeader>

          {/* Thumbnail preview */}
          <div className="rounded-lg border border-border overflow-hidden bg-muted">
            <img
              src={getThumbnail()}
              alt="Whiteboard preview"
              className="w-full h-32 object-contain bg-white"
            />
          </div>

          {/* Student list */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium">Select students</span>
            <button
              onClick={toggleAll}
              className="text-xs text-teacher font-semibold hover:underline"
            >
              {selectedStudents.size === students.length ? "Deselect All" : "Select All"}
            </button>
          </div>

          <ScrollArea className="max-h-48 border border-border rounded-lg">
            {students.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No students assigned</p>
            ) : (
              <div className="divide-y divide-border">
                {students.map((s) => (
                  <label
                    key={s.user_id}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedStudents.has(s.user_id)}
                      onCheckedChange={() => toggleStudent(s.user_id)}
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                      <span className="text-sm">{s.student_name}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)}>Cancel</Button>
            <Button
              variant="teacher"
              onClick={sendToStudents}
              disabled={selectedStudents.size === 0 || sending}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send ({selectedStudents.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
