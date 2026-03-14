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
  type: "line" | "rect" | "circle" | "arrow" | "connector" | "frame";
  start: Point;
  end: Point;
  color: string;
  size: number;
  label?: string;
}

interface TextItem {
  x: number; y: number;
  text: string;
  color: string;
  size: number;
  font?: string;
}

interface StickyNoteItem {
  x: number; y: number;
  text: string;
  bgColor: string;
  width: number;
  height: number;
}

interface CommentItem {
  x: number; y: number;
  text: string;
  color: string;
}

interface TableItem {
  x: number; y: number;
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  color: string;
}

interface ImageItemData {
  x: number; y: number;
  width: number;
  height: number;
  dataUrl: string;
}

interface WhiteboardState {
  strokes: Stroke[];
  shapes: ShapeItem[];
  texts: TextItem[];
  stickyNotes: StickyNoteItem[];
  comments: CommentItem[];
  tables: TableItem[];
  images: ImageItemData[];
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

const STICKY_COLORS = ["#fff9c4", "#c8e6c9", "#bbdefb", "#f8bbd0", "#ffe0b2", "#e1bee7"];

const STROKE_SIZES = [2, 4, 6, 10, 16];

const MAX_HISTORY = 40;
const CANVAS_W = 2400;
const CANVAS_H = 1600;
const GRID_SIZE = 25;

const emptyState = (): WhiteboardState => ({
  strokes: [], shapes: [], texts: [], stickyNotes: [], comments: [], tables: [], images: [],
});

const wb = () => supabase.from("whiteboards" as any);

export function Whiteboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

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

  // Text/equation tool input
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean; mode: "text" | "equation" | "sticky" | "comment" | "frame" }>({ x: 0, y: 0, visible: false, mode: "text" });
  const [textValue, setTextValue] = useState("");
  // For sticky note placement
  const [stickyCanvasPos, setStickyCanvasPos] = useState<Point>({ x: 0, y: 0 });
  // For frame placement
  const [frameEndPos, setFrameEndPos] = useState<Point>({ x: 0, y: 0 });

  // Send to students modal
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // State
  const stateRef = useRef<WhiteboardState>(emptyState());
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

  const getScreenPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.strokeStyle = "#e8edf2";
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= CANVAS_W; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= CANVAS_H; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
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
      ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.type === "connector") {
      // Bezier curve connector
      const midX = (shape.start.x + shape.end.x) / 2;
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.bezierCurveTo(midX, shape.start.y, midX, shape.end.y, shape.end.x, shape.end.y);
      ctx.stroke();
      // Draw small circles at endpoints
      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.arc(shape.start.x, shape.start.y, shape.size + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(shape.end.x, shape.end.y, shape.size + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape.type === "frame") {
      // Dashed frame rectangle
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2;
      const x = Math.min(shape.start.x, shape.end.x);
      const y = Math.min(shape.start.y, shape.end.y);
      const w = Math.abs(shape.end.x - shape.start.x);
      const h = Math.abs(shape.end.y - shape.start.y);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      // Label
      if (shape.label) {
        ctx.font = "bold 18px 'Inter', sans-serif";
        ctx.fillStyle = shape.color;
        ctx.fillText(shape.label, x + 8, y - 8);
      }
    }
    ctx.restore();
  };

  const drawStickyNote = (ctx: CanvasRenderingContext2D, note: StickyNoteItem) => {
    ctx.save();
    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
    // Background
    ctx.fillStyle = note.bgColor;
    ctx.fillRect(note.x, note.y, note.width, note.height);
    ctx.shadowColor = "transparent";
    // Border
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(note.x, note.y, note.width, note.height);
    // Text
    ctx.fillStyle = "#333333";
    ctx.font = "16px 'Inter', sans-serif";
    const lines = wrapText(ctx, note.text, note.width - 20);
    lines.forEach((line, i) => {
      ctx.fillText(line, note.x + 10, note.y + 28 + i * 22);
    });
    ctx.restore();
  };

  const drawComment = (ctx: CanvasRenderingContext2D, comment: CommentItem) => {
    ctx.save();
    const w = Math.max(ctx.measureText(comment.text).width + 24, 60);
    const h = 36;
    const r = 12;
    const tailH = 10;
    // Bubble
    ctx.fillStyle = comment.color;
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.beginPath();
    ctx.moveTo(comment.x + r, comment.y);
    ctx.lineTo(comment.x + w - r, comment.y);
    ctx.quadraticCurveTo(comment.x + w, comment.y, comment.x + w, comment.y + r);
    ctx.lineTo(comment.x + w, comment.y + h - r);
    ctx.quadraticCurveTo(comment.x + w, comment.y + h, comment.x + w - r, comment.y + h);
    // Tail
    ctx.lineTo(comment.x + 24, comment.y + h);
    ctx.lineTo(comment.x + 12, comment.y + h + tailH);
    ctx.lineTo(comment.x + 18, comment.y + h);
    ctx.lineTo(comment.x + r, comment.y + h);
    ctx.quadraticCurveTo(comment.x, comment.y + h, comment.x, comment.y + h - r);
    ctx.lineTo(comment.x, comment.y + r);
    ctx.quadraticCurveTo(comment.x, comment.y, comment.x + r, comment.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";
    // Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillText(comment.text, comment.x + 12, comment.y + 23);
    ctx.restore();
  };

  const drawTable = (ctx: CanvasRenderingContext2D, table: TableItem) => {
    ctx.save();
    ctx.strokeStyle = table.color;
    ctx.lineWidth = 1.5;
    const totalW = table.cols * table.cellWidth;
    const totalH = table.rows * table.cellHeight;
    // Fill header row
    ctx.fillStyle = table.color + "18";
    ctx.fillRect(table.x, table.y, totalW, table.cellHeight);
    // Draw grid
    for (let r = 0; r <= table.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(table.x, table.y + r * table.cellHeight);
      ctx.lineTo(table.x + totalW, table.y + r * table.cellHeight);
      ctx.stroke();
    }
    for (let c = 0; c <= table.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(table.x + c * table.cellWidth, table.y);
      ctx.lineTo(table.x + c * table.cellWidth, table.y + totalH);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawImageItem = (ctx: CanvasRenderingContext2D, item: ImageItemData) => {
    const cached = loadedImagesRef.current.get(item.dataUrl);
    if (cached) {
      ctx.drawImage(cached, item.x, item.y, item.width, item.height);
    } else {
      // Load async
      const img = new Image();
      img.onload = () => {
        loadedImagesRef.current.set(item.dataUrl, img);
        render();
      };
      img.src = item.dataUrl;
    }
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [""];
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGrid(ctx);

    const { strokes, shapes, texts, stickyNotes, comments, tables, images } = stateRef.current;

    // Draw images first (background layer)
    for (const img of images) drawImageItem(ctx, img);

    // Draw strokes
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : s.color;
      ctx.lineWidth = s.tool === "eraser" ? s.size * 4 : s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Draw shapes
    for (const shape of shapes) drawShape(ctx, shape);

    // Draw current stroke in progress
    if (currentStroke.current && currentStroke.current.points.length >= 2) {
      const s = currentStroke.current;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : s.color;
      ctx.lineWidth = s.tool === "eraser" ? s.size * 4 : s.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }

    // Draw shape preview
    if (shapeStart.current && shapePreview.current) {
      const shapeTool = tool as string;
      if (["line", "rect", "circle", "arrow", "connector", "frame"].includes(shapeTool)) {
        drawShape(ctx, {
          type: shapeTool as ShapeItem["type"],
          start: shapeStart.current,
          end: shapePreview.current,
          color,
          size: strokeSize,
          label: shapeTool === "frame" ? "Frame" : undefined,
        });
      }
    }

    // Draw tables
    for (const t of tables) drawTable(ctx, t);

    // Draw sticky notes
    for (const note of stickyNotes) drawStickyNote(ctx, note);

    // Draw comments
    for (const c of comments) drawComment(ctx, c);

    // Draw texts
    for (const t of texts) {
      ctx.font = t.font || `${t.size * 4 + 14}px 'Inter', sans-serif`;
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
    stateRef.current = emptyState();
    loadedImagesRef.current.clear();
    pushHistory();
    render();
  };

  const isShapeTool = (t: Tool) => ["line", "rect", "circle", "arrow", "connector", "frame"].includes(t);
  const isClickPlaceTool = (t: Tool) => ["text", "equation", "sticky", "comment", "table"].includes(t);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);
    const screenPos = getScreenPos(e);

    if (tool === "pointer") return;

    if (tool === "image") {
      fileInputRef.current?.click();
      return;
    }

    if (tool === "table") {
      // Place a 3×3 table at click position
      stateRef.current.tables.push({
        x: pos.x,
        y: pos.y,
        rows: 3,
        cols: 3,
        cellWidth: 120,
        cellHeight: 40,
        color,
      });
      pushHistory();
      render();
      return;
    }

    if (tool === "text" || tool === "equation") {
      e.preventDefault();
      setStickyCanvasPos(pos);
      setTextInput({ x: screenPos.x, y: screenPos.y, visible: true, mode: tool });
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    if (tool === "sticky") {
      e.preventDefault();
      setStickyCanvasPos(pos);
      setTextInput({ x: screenPos.x, y: screenPos.y, visible: true, mode: "sticky" });
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    if (tool === "comment") {
      e.preventDefault();
      setStickyCanvasPos(pos);
      setTextInput({ x: screenPos.x, y: screenPos.y, visible: true, mode: "comment" });
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    if (isShapeTool(tool)) {
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

    if (isShapeTool(tool) && shapeStart.current) {
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

    if (isShapeTool(tool) && shapeStart.current && shapePreview.current) {
      if (tool === "frame") {
        // For frame, prompt for label
        const label = "Frame";
        stateRef.current.shapes.push({
          type: "frame",
          start: shapeStart.current,
          end: shapePreview.current,
          color,
          size: strokeSize,
          label,
        });
      } else {
        stateRef.current.shapes.push({
          type: tool as ShapeItem["type"],
          start: shapeStart.current,
          end: shapePreview.current,
          color,
          size: strokeSize,
        });
      }
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

    const pos = stickyCanvasPos;

    if (textInput.mode === "text") {
      stateRef.current.texts.push({
        x: pos.x, y: pos.y,
        text: textValue,
        color,
        size: strokeSize,
      });
    } else if (textInput.mode === "equation") {
      stateRef.current.texts.push({
        x: pos.x, y: pos.y,
        text: textValue,
        color,
        size: strokeSize,
        font: `italic ${strokeSize * 4 + 16}px 'Times New Roman', serif`,
      });
    } else if (textInput.mode === "sticky") {
      const bgColor = STICKY_COLORS[stateRef.current.stickyNotes.length % STICKY_COLORS.length];
      stateRef.current.stickyNotes.push({
        x: pos.x, y: pos.y,
        text: textValue,
        bgColor,
        width: 200,
        height: 150,
      });
    } else if (textInput.mode === "comment") {
      stateRef.current.comments.push({
        x: pos.x, y: pos.y,
        text: textValue,
        color: color,
      });
    }

    setTextInput({ ...textInput, visible: false });
    setTextValue("");
    pushHistory();
    render();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Scale to fit reasonably on canvas
        let w = img.width;
        let h = img.height;
        const maxDim = 600;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = w * scale;
          h = h * scale;
        }
        loadedImagesRef.current.set(dataUrl, img);
        stateRef.current.images.push({
          x: CANVAS_W / 2 - w / 2,
          y: CANVAS_H / 2 - h / 2,
          width: w,
          height: h,
          dataUrl,
        });
        pushHistory();
        render();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be uploaded again
    e.target.value = "";
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
          stickyNotes: parsed.stickyNotes || [],
          comments: parsed.comments || [],
          tables: parsed.tables || [],
          images: parsed.images || [],
        };
      } catch {
        stateRef.current = emptyState();
        toast({ title: "Legacy board", description: "Old format loaded as empty." });
      }

      setTitle(board.title);
      setCurrentBoardId(board.id);
      setShareLink(board.share_token ? `${window.location.origin}/whiteboard?token=${board.share_token}` : null);
      loadedImagesRef.current.clear();
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
    stateRef.current = emptyState();
    loadedImagesRef.current.clear();
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
      if (next.has(id)) next.delete(id); else next.add(id);
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
      if (!currentBoardId) await saveToDatabase();
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

  const getThumbnail = (): string => {
    const canvas = canvasRef.current;
    if (!canvas) return "";
    return canvas.toDataURL("image/png");
  };

  const canUndo = historyIdxRef.current > 0;
  const canRedo = historyIdxRef.current < historyRef.current.length - 1;

  const shapeTools: { id: Tool; icon: React.ElementType; label: string }[] = [
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: CircleIcon, label: "Circle" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "arrow", icon: ArrowUpRight, label: "Arrow" },
  ];

  const activeShapeTool = shapeTools.find(s => s.id === tool);
  const ShapeIcon = activeShapeTool?.icon || Square;

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-[9999] bg-background flex flex-col"
    : "space-y-3 h-full flex flex-col";

  const getCursor = () => {
    if (tool === "pointer") return "default";
    if (tool === "text" || tool === "equation") return "text";
    if (tool === "eraser") return "cell";
    if (tool === "sticky" || tool === "comment" || tool === "table") return "copy";
    if (tool === "image") return "pointer";
    return "crosshair";
  };

  const getInputPlaceholder = () => {
    switch (textInput.mode) {
      case "equation": return "e.g. x² + y² = r²";
      case "sticky": return "Sticky note text...";
      case "comment": return "Add comment...";
      case "frame": return "Frame label...";
      default: return "Type and press Enter";
    }
  };

  const ToolBtn = ({ id, icon: Icon, label }: { id: Tool; icon: React.ElementType; label: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => setTool(id)}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
            tool === id
              ? "bg-teacher/10 border-2 border-teacher text-teacher shadow-sm"
              : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={200}>
    <div className={containerClasses}>
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

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
      <div className="flex flex-1 gap-3 px-3 pb-3 min-h-0">
        {/* Left Toolbar */}
        <div className="flex flex-col items-center gap-0.5 py-3 px-1.5 bg-card rounded-2xl shadow-lg border border-border/50 self-start">
          <ToolBtn id="pointer" icon={MousePointer2} label="Pointer" />
          <ToolBtn id="pen" icon={Pencil} label="Pen" />

          {/* Shapes dropdown */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all relative",
                      activeShapeTool
                        ? "bg-teacher/10 border-2 border-teacher text-teacher shadow-sm"
                        : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <ShapeIcon className="h-[18px] w-[18px]" />
                    <ChevronDown className="h-2.5 w-2.5 absolute bottom-1 right-1 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Shapes</TooltipContent>
            </Tooltip>
            <DropdownMenuContent side="right" align="start" className="min-w-[140px]">
              {shapeTools.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => setTool(s.id)} className="gap-2">
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <ToolBtn id="connector" icon={Spline} label="Connector" />
          <ToolBtn id="text" icon={Type} label="Text" />
          <ToolBtn id="equation" icon={Sigma} label="Equation (Σ)" />
          <ToolBtn id="sticky" icon={StickyNote} label="Sticky Note" />
          <ToolBtn id="comment" icon={MessageCircle} label="Comment" />
          <ToolBtn id="frame" icon={Hash} label="Frame" />
          <ToolBtn id="table" icon={Table2} label="Table (3×3)" />
          <ToolBtn id="image" icon={ImagePlus} label="Image Upload" />

          <div className="w-7 h-px bg-border my-1.5" />

          <ToolBtn id="eraser" icon={Eraser} label="Eraser" />

          <Tooltip>
            <TooltipTrigger asChild>
              <button className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">More tools</TooltipContent>
          </Tooltip>

          <div className="w-7 h-px bg-border my-1.5" />

          {STROKE_SIZES.map((s) => (
            <Tooltip key={s}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setStrokeSize(s)}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                    strokeSize === s
                      ? "bg-teacher/10 border-2 border-teacher"
                      : "bg-transparent hover:bg-muted"
                  )}
                >
                  <span
                    className="rounded-full bg-foreground"
                    style={{ width: Math.min(s * 1.5, 20), height: Math.min(s * 1.5, 20) }}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Size {s}px</TooltipContent>
            </Tooltip>
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
            style={{ cursor: getCursor(), touchAction: "none" }}
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
              className={cn(
                "absolute border-b-2 outline-none px-2 py-1 text-sm shadow-sm rounded",
                textInput.mode === "equation"
                  ? "bg-card border-primary text-foreground italic font-serif"
                  : textInput.mode === "sticky"
                  ? "bg-yellow-100 border-yellow-400 text-yellow-900"
                  : textInput.mode === "comment"
                  ? "bg-card border-teacher text-foreground"
                  : "bg-transparent border-teacher text-foreground"
              )}
              style={{ left: textInput.x, top: textInput.y - 10, minWidth: 160 }}
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput({ ...textInput, visible: false }); }}
              onBlur={commitText}
              placeholder={getInputPlaceholder()}
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
              style={{ background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` }}
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
          <div className="rounded-lg border border-border overflow-hidden bg-muted">
            <img src={getThumbnail()} alt="Whiteboard preview" className="w-full h-32 object-contain bg-white" />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium">Select students</span>
            <button onClick={toggleAll} className="text-xs text-teacher font-semibold hover:underline">
              {selectedStudents.size === students.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <ScrollArea className="max-h-48 border border-border rounded-lg">
            {students.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No students assigned</p>
            ) : (
              <div className="divide-y divide-border">
                {students.map((s) => (
                  <label key={s.user_id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selectedStudents.has(s.user_id)} onCheckedChange={() => toggleStudent(s.user_id)} />
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
            <Button variant="teacher" onClick={sendToStudents} disabled={selectedStudents.size === 0 || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send ({selectedStudents.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
