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
  Maximize, Minimize, ArrowUpRight, Spline,
  StickyNote, Hash, Table2, ImagePlus,
  ChevronDown, Hand, Crosshair, ZoomIn, ZoomOut,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Tool = "move" | "pen" | "eraser" | "line" | "rect" | "circle" | "arrow" | "connector" | "text" | "sticky" | "frame" | "table" | "image" | "laser";

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

interface LaserPoint {
  x: number; y: number;
  time: number;
}

interface WhiteboardState {
  strokes: Stroke[];
  shapes: ShapeItem[];
  texts: TextItem[];
  stickyNotes: StickyNoteItem[];
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

interface WhiteboardShare {
  id: string;
  whiteboard_id: string;
  student_user_id: string;
  teacher_user_id: string;
  title: string;
  thumbnail_data: string | null;
  sent_at: string;
  deleted_at: string | null;
}

const COLORS = [
  "#1a1a2e", "#e74c3c", "#2980b9", "#27ae60",
  "#f39c12", "#8e44ad", "#e91e63", "#00bcd4",
  "#ff5722", "#795548", "#607d8b", "#9c27b0",
];

const STICKY_COLORS = ["#fff9c4", "#c8e6c9", "#bbdefb", "#f8bbd0", "#ffe0b2", "#e1bee7"];

const STROKE_SIZES = [2, 4, 6, 10, 16];

const MAX_HISTORY = 40;
const GRID_SIZE = 25;
const LASER_FADE_MS = 1000;

const emptyState = (): WhiteboardState => ({
  strokes: [], shapes: [], texts: [], stickyNotes: [], tables: [], images: [],
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
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Student dropdown + sent history
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sentWhiteboards, setSentWhiteboards] = useState<WhiteboardShare[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Infinite canvas: pan offset and zoom
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panOffsetStartRef = useRef<Point>({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);

  // Image drag/resize
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null);
  const imageDragRef = useRef<{ idx: number; offsetX: number; offsetY: number; mode: "move" | "resize"; corner?: string } | null>(null);

  // Text/sticky tool input
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean; mode: "text" | "sticky" | "frame" }>({ x: 0, y: 0, visible: false, mode: "text" });
  const [textValue, setTextValue] = useState("");
  const [stickyCanvasPos, setStickyCanvasPos] = useState<Point>({ x: 0, y: 0 });

  // Laser pointer
  const laserTrailRef = useRef<LaserPoint[]>([]);
  const laserAnimRef = useRef<number>(0);

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

  // Canvas dimensions (match container)
  const getCanvasDims = () => {
    const container = containerRef.current;
    if (!container) return { w: 1920, h: 1080 };
    return { w: container.clientWidth, h: container.clientHeight };
  };

  // Resize canvas to fill container
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      render();
    };
    // Small delay to let layout settle after fullscreen toggle
    const timer = setTimeout(resize, 50);
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(resize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { clearTimeout(timer); window.removeEventListener("resize", resize); observer.disconnect(); };
  }, [isFullscreen]);

  // Space key for panning
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && !textInput.visible) {
        e.preventDefault();
        spaceHeldRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceHeldRef.current = false;
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [textInput.visible]);

  // Laser animation loop
  useEffect(() => {
    if (tool !== "laser") {
      laserTrailRef.current = [];
      return;
    }
    const animate = () => {
      const now = Date.now();
      laserTrailRef.current = laserTrailRef.current.filter(p => now - p.time < LASER_FADE_MS);
      render();
      laserAnimRef.current = requestAnimationFrame(animate);
    };
    laserAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(laserAnimRef.current);
  }, [tool]);

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

  // Convert screen coordinates to world coordinates
  const screenToWorld = (screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (screenX - rect.left - panOffset.x) / zoom;
    const y = (screenY - rect.top - panOffset.y) / zoom;
    return { x, y };
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return screenToWorld(clientX, clientY);
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
    ctx.lineWidth = 0.5 / zoom;

    const canvas = canvasRef.current!;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    // Calculate visible world bounds
    const worldLeft = -panOffset.x / zoom;
    const worldTop = -panOffset.y / zoom;
    const worldRight = worldLeft + w / zoom;
    const worldBottom = worldTop + h / zoom;

    const gridStep = GRID_SIZE;
    const startX = Math.floor(worldLeft / gridStep) * gridStep;
    const startY = Math.floor(worldTop / gridStep) * gridStep;

    for (let x = startX; x <= worldRight; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, worldTop); ctx.lineTo(x, worldBottom); ctx.stroke();
    }
    for (let y = startY; y <= worldBottom; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(worldLeft, y); ctx.lineTo(worldRight, y); ctx.stroke();
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
      const midX = (shape.start.x + shape.end.x) / 2;
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.bezierCurveTo(midX, shape.start.y, midX, shape.end.y, shape.end.x, shape.end.y);
      ctx.stroke();
      ctx.fillStyle = shape.color;
      ctx.beginPath();
      ctx.arc(shape.start.x, shape.start.y, shape.size + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(shape.end.x, shape.end.y, shape.size + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape.type === "frame") {
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2;
      const x = Math.min(shape.start.x, shape.end.x);
      const y = Math.min(shape.start.y, shape.end.y);
      const w = Math.abs(shape.end.x - shape.start.x);
      const h = Math.abs(shape.end.y - shape.start.y);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
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
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = note.bgColor;
    ctx.fillRect(note.x, note.y, note.width, note.height);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    ctx.lineWidth = 1;
    ctx.strokeRect(note.x, note.y, note.width, note.height);
    ctx.fillStyle = "#333333";
    ctx.font = "16px 'Inter', sans-serif";
    const lines = wrapText(ctx, note.text, note.width - 20);
    lines.forEach((line, i) => {
      ctx.fillText(line, note.x + 10, note.y + 28 + i * 22);
    });
    ctx.restore();
  };

  const drawTable = (ctx: CanvasRenderingContext2D, table: TableItem) => {
    ctx.save();
    ctx.strokeStyle = table.color;
    ctx.lineWidth = 1.5;
    const totalW = table.cols * table.cellWidth;
    const totalH = table.rows * table.cellHeight;
    ctx.fillStyle = table.color + "18";
    ctx.fillRect(table.x, table.y, totalW, table.cellHeight);
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

  const drawImageItem = (ctx: CanvasRenderingContext2D, item: ImageItemData, idx: number) => {
    const cached = loadedImagesRef.current.get(item.dataUrl);
    if (cached) {
      ctx.drawImage(cached, item.x, item.y, item.width, item.height);
      // Draw selection handles
      if (selectedImageIdx === idx) {
        ctx.save();
        ctx.strokeStyle = "#2980b9";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.strokeRect(item.x, item.y, item.width, item.height);
        ctx.setLineDash([]);
        // Corner handles
        const hs = 8 / zoom;
        ctx.fillStyle = "#2980b9";
        const corners = [
          { x: item.x, y: item.y },
          { x: item.x + item.width, y: item.y },
          { x: item.x, y: item.y + item.height },
          { x: item.x + item.width, y: item.y + item.height },
        ];
        for (const c of corners) {
          ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
        }
        ctx.restore();
      }
    } else {
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
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Apply pan and zoom
    ctx.save();
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoom, zoom);

    drawGrid(ctx);

    const { strokes, shapes, texts, stickyNotes, tables, images } = stateRef.current;

    // Draw images (background layer)
    images.forEach((img, idx) => drawImageItem(ctx, img, idx));

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

    // Current stroke in progress
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

    // Shape preview
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

    // Tables
    for (const t of tables) drawTable(ctx, t);

    // Sticky notes
    for (const note of stickyNotes) drawStickyNote(ctx, note);

    // Texts
    for (const t of texts) {
      ctx.font = t.font || `${t.size * 4 + 14}px 'Inter', sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.restore(); // end pan/zoom transform

    // Draw laser trail (in screen space, on top of everything)
    if (tool === "laser" && laserTrailRef.current.length > 0) {
      const now = Date.now();
      const trail = laserTrailRef.current;
      for (let i = 0; i < trail.length; i++) {
        const age = now - trail[i].time;
        const alpha = Math.max(0, 1 - age / LASER_FADE_MS);
        const r = 6 * alpha + 2;
        // Convert world to screen
        const sx = trail[i].x * zoom + panOffset.x;
        const sy = trail[i].y * zoom + panOffset.y;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 30, 30, ${alpha * 0.9})`;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 30, 30, ${alpha * 0.2})`;
        ctx.fill();
      }
    }
  }, [tool, color, strokeSize, panOffset, zoom, selectedImageIdx]);

  useEffect(() => {
    render();
    pushHistory();
  }, []);

  useEffect(() => { render(); }, [panOffset, zoom, selectedImageIdx]);

  useEffect(() => {
    if (user) {
      fetchSavedBoards();
      fetchStudents();
    }
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

  const fetchSentWhiteboards = async (studentId: string) => {
    if (!user) return;
    setLoadingSent(true);
    try {
      const { data } = await supabase
        .from("whiteboard_shares" as any)
        .select("*")
        .eq("teacher_user_id", user.id)
        .eq("student_user_id", studentId)
        .is("deleted_at", null)
        .order("sent_at", { ascending: false });
      setSentWhiteboards((data as unknown as WhiteboardShare[]) || []);
    } catch (err) {
      console.error("Error fetching sent whiteboards:", err);
    } finally {
      setLoadingSent(false);
    }
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    fetchSentWhiteboards(studentId);
  };

  const deleteSentWhiteboard = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("whiteboard_shares" as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", shareId);
      if (error) throw error;
      toast({ title: "Deleted", description: "Whiteboard removed." });
      if (selectedStudentId) fetchSentWhiteboards(selectedStudentId);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const editSentWhiteboard = async (share: WhiteboardShare) => {
    // Load the whiteboard from the whiteboards table
    await loadBoard(share.whiteboard_id);
  };

  const clearCanvas = () => {
    stateRef.current = emptyState();
    loadedImagesRef.current.clear();
    setSelectedImageIdx(null);
    pushHistory();
    render();
  };

  const isShapeTool = (t: Tool) => ["line", "rect", "circle", "arrow", "connector", "frame"].includes(t);
  const isClickPlaceTool = (t: Tool) => ["text", "sticky", "table"].includes(t);

  // Check if click is on an image (for selection)
  const hitTestImage = (worldPos: Point): number | null => {
    const images = stateRef.current.images;
    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      if (worldPos.x >= img.x && worldPos.x <= img.x + img.width &&
          worldPos.y >= img.y && worldPos.y <= img.y + img.height) {
        return i;
      }
    }
    return null;
  };

  // Check if click is on a resize corner of selected image
  const hitTestImageCorner = (worldPos: Point): string | null => {
    if (selectedImageIdx === null) return null;
    const img = stateRef.current.images[selectedImageIdx];
    if (!img) return null;
    const hs = 12 / zoom;
    const corners: { name: string; x: number; y: number }[] = [
      { name: "tl", x: img.x, y: img.y },
      { name: "tr", x: img.x + img.width, y: img.y },
      { name: "bl", x: img.x, y: img.y + img.height },
      { name: "br", x: img.x + img.width, y: img.y + img.height },
    ];
    for (const c of corners) {
      if (Math.abs(worldPos.x - c.x) < hs && Math.abs(worldPos.y - c.y) < hs) {
        return c.name;
      }
    }
    return null;
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);
    const screenPos = getScreenPos(e);
    const isMiddleButton = "button" in e && (e as React.MouseEvent).button === 1;

    // Pan: Space held, Move tool, or middle mouse button
    if (spaceHeldRef.current || tool === "move" || isMiddleButton) {
      e.preventDefault();
      isPanningRef.current = true;
      let clientX: number, clientY: number;
      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
      }
      panStartRef.current = { x: clientX, y: clientY };
      panOffsetStartRef.current = { ...panOffset };
      return;
    }

    if (tool === "laser") {
      e.preventDefault();
      setIsDrawing(true);
      laserTrailRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
      return;
    }

    if (tool === "image") {
      // Check if clicking on selected image corner for resize
      const corner = hitTestImageCorner(pos);
      if (corner && selectedImageIdx !== null) {
        imageDragRef.current = { idx: selectedImageIdx, offsetX: pos.x, offsetY: pos.y, mode: "resize", corner };
        setIsDrawing(true);
        e.preventDefault();
        return;
      }
      // Check if clicking on an image to select/move
      const imgIdx = hitTestImage(pos);
      if (imgIdx !== null) {
        const img = stateRef.current.images[imgIdx];
        setSelectedImageIdx(imgIdx);
        imageDragRef.current = { idx: imgIdx, offsetX: pos.x - img.x, offsetY: pos.y - img.y, mode: "move" };
        setIsDrawing(true);
        e.preventDefault();
        return;
      }
      // No image clicked: deselect and open file picker
      setSelectedImageIdx(null);
      fileInputRef.current?.click();
      return;
    }

    // Deselect image when using other tools
    setSelectedImageIdx(null);

    if (tool === "table") {
      stateRef.current.tables.push({
        x: pos.x, y: pos.y,
        rows: 3, cols: 3,
        cellWidth: 120, cellHeight: 40,
        color,
      });
      pushHistory();
      render();
      return;
    }

    if (tool === "text") {
      e.preventDefault();
      setStickyCanvasPos(pos);
      setTextInput({ x: screenPos.x, y: screenPos.y, visible: true, mode: "text" });
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
    // Panning
    if (isPanningRef.current) {
      let clientX: number, clientY: number;
      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX; clientY = e.touches[0].clientY;
      } else {
        clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY;
      }
      setPanOffset({
        x: panOffsetStartRef.current.x + (clientX - panStartRef.current.x),
        y: panOffsetStartRef.current.y + (clientY - panStartRef.current.y),
      });
      return;
    }

    if (!isDrawing) return;
    e.preventDefault();
    const pos = getCanvasPos(e);

    if (tool === "laser") {
      laserTrailRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
      return;
    }

    // Image drag/resize
    if (imageDragRef.current) {
      const ref = imageDragRef.current;
      const img = stateRef.current.images[ref.idx];
      if (!img) return;
      if (ref.mode === "move") {
        img.x = pos.x - ref.offsetX;
        img.y = pos.y - ref.offsetY;
      } else if (ref.mode === "resize" && ref.corner) {
        const corner = ref.corner;
        if (corner === "br") {
          img.width = Math.max(30, pos.x - img.x);
          img.height = Math.max(30, pos.y - img.y);
        } else if (corner === "bl") {
          const newW = Math.max(30, (img.x + img.width) - pos.x);
          img.x = img.x + img.width - newW;
          img.width = newW;
          img.height = Math.max(30, pos.y - img.y);
        } else if (corner === "tr") {
          img.width = Math.max(30, pos.x - img.x);
          const newH = Math.max(30, (img.y + img.height) - pos.y);
          img.y = img.y + img.height - newH;
          img.height = newH;
        } else if (corner === "tl") {
          const newW = Math.max(30, (img.x + img.width) - pos.x);
          const newH = Math.max(30, (img.y + img.height) - pos.y);
          img.x = img.x + img.width - newW;
          img.y = img.y + img.height - newH;
          img.width = newW;
          img.height = newH;
        }
      }
      render();
      return;
    }

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
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (tool === "laser") {
      setIsDrawing(false);
      return;
    }

    if (imageDragRef.current) {
      imageDragRef.current = null;
      setIsDrawing(false);
      pushHistory();
      render();
      return;
    }

    if (!isDrawing) return;

    if (isShapeTool(tool) && shapeStart.current && shapePreview.current) {
      if (tool === "frame") {
        stateRef.current.shapes.push({
          type: "frame",
          start: shapeStart.current,
          end: shapePreview.current,
          color,
          size: strokeSize,
          label: "Frame",
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
    } else if (textInput.mode === "sticky") {
      const bgColor = STICKY_COLORS[stateRef.current.stickyNotes.length % STICKY_COLORS.length];
      stateRef.current.stickyNotes.push({
        x: pos.x, y: pos.y,
        text: textValue,
        bgColor,
        width: 200,
        height: 150,
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
        let w = img.width;
        let h = img.height;
        const maxDim = 600;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = w * scale;
          h = h * scale;
        }
        loadedImagesRef.current.set(dataUrl, img);
        // Place image at center of current view
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const viewW = (canvas?.width || 1920) / dpr;
        const viewH = (canvas?.height || 1080) / dpr;
        const centerWorldX = (-panOffset.x + viewW / 2) / zoom - w / 2;
        const centerWorldY = (-panOffset.y + viewH / 2) / zoom - h / 2;
        const newIdx = stateRef.current.images.length;
        stateRef.current.images.push({
          x: centerWorldX,
          y: centerWorldY,
          width: w,
          height: h,
          dataUrl,
        });
        setSelectedImageIdx(newIdx);
        pushHistory();
        render();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Zoom with scroll wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(10, Math.max(0.1, zoom * zoomFactor));

    // Zoom toward cursor
    const newPanX = mouseX - (mouseX - panOffset.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - panOffset.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  };

  const handleDoubleClick = () => {
    setIsFullscreen(prev => !prev);
  };

  const zoomIn = () => {
    const newZoom = Math.min(10, zoom * 1.25);
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas?.width || 1920) / dpr;
    const h = (canvas?.height || 1080) / dpr;
    const cx = w / 2;
    const cy = h / 2;
    setPanOffset({ x: cx - (cx - panOffset.x) * (newZoom / zoom), y: cy - (cy - panOffset.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(0.1, zoom / 1.25);
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas?.width || 1920) / dpr;
    const h = (canvas?.height || 1080) / dpr;
    const cx = w / 2;
    const cy = h / 2;
    setPanOffset({ x: cx - (cx - panOffset.x) * (newZoom / zoom), y: cy - (cy - panOffset.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  const resetView = () => {
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const saveToPNG = () => {
    // Render to an offscreen canvas with all content
    const offscreen = document.createElement("canvas");
    // Find bounding box of all content
    const state = stateRef.current;
    let minX = 0, minY = 0, maxX = 1920, maxY = 1080;
    for (const s of state.strokes) {
      for (const p of s.points) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
    }
    for (const s of state.shapes) {
      minX = Math.min(minX, s.start.x, s.end.x); minY = Math.min(minY, s.start.y, s.end.y);
      maxX = Math.max(maxX, s.start.x, s.end.x); maxY = Math.max(maxY, s.start.y, s.end.y);
    }
    for (const img of state.images) {
      minX = Math.min(minX, img.x); minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + img.width); maxY = Math.max(maxY, img.y + img.height);
    }
    const pad = 50;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const w = maxX - minX;
    const h = maxY - minY;
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.translate(-minX, -minY);

    // Draw grid
    ctx.strokeStyle = "#e8edf2";
    ctx.lineWidth = 0.5;
    const startGX = Math.floor(minX / GRID_SIZE) * GRID_SIZE;
    const startGY = Math.floor(minY / GRID_SIZE) * GRID_SIZE;
    for (let x = startGX; x <= maxX; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, minY); ctx.lineTo(x, maxY); ctx.stroke();
    }
    for (let y = startGY; y <= maxY; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(minX, y); ctx.lineTo(maxX, y); ctx.stroke();
    }

    for (const img of state.images) {
      const cached = loadedImagesRef.current.get(img.dataUrl);
      if (cached) ctx.drawImage(cached, img.x, img.y, img.width, img.height);
    }
    for (const s of state.strokes) {
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
    for (const shape of state.shapes) drawShape(ctx, shape);
    for (const t of state.tables) drawTable(ctx, t);
    for (const note of state.stickyNotes) drawStickyNote(ctx, note);
    for (const t of state.texts) {
      ctx.font = t.font || `${t.size * 4 + 14}px 'Inter', sans-serif`;
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
          tables: parsed.tables || [],
          images: parsed.images || [],
        };
      } catch {
        stateRef.current = emptyState();
        toast({ title: "Legacy board", description: "Old format loaded as empty." });
      }

      setTitle(board.title);
      setCurrentBoardId(board.id);
      // Board loaded
      loadedImagesRef.current.clear();
      setSelectedImageIdx(null);
      setPanOffset({ x: 0, y: 0 });
      setZoom(1);
      pushHistory();
      render();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  const newBoard = () => {
    setCurrentBoardId(null);
    setTitle("Untitled Whiteboard");
    // New board created
    stateRef.current = emptyState();
    loadedImagesRef.current.clear();
    setSelectedImageIdx(null);
    historyRef.current = [];
    historyIdxRef.current = -1;
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
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
      // Save the board first if not saved
      if (!currentBoardId) await saveToDatabase();
      
      // Generate thumbnail from canvas
      const thumbnail = getThumbnail();
      
      // Insert whiteboard_shares records
      const shares = Array.from(selectedStudents).map(studentId => ({
        whiteboard_id: currentBoardId,
        student_user_id: studentId,
        teacher_user_id: user.id,
        title,
        thumbnail_data: thumbnail,
      }));
      
      const { error: shareError } = await supabase
        .from("whiteboard_shares" as any)
        .insert(shares as any);
      if (shareError) throw shareError;

      // Also send notifications
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
      await supabase.from("notifications").insert(notifications);
      
      toast({ title: "✅ Whiteboard shared!", description: "Students will see it in their dashboard." });
      // Refresh sent list if a student is selected
      if (selectedStudentId) fetchSentWhiteboards(selectedStudentId);
      setTimeout(() => setSendModalOpen(false), 1500);
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
    ? "fixed inset-0 z-[9999] bg-background flex flex-col overflow-hidden"
    : "h-full flex flex-col gap-3 overflow-hidden";

  const getCursor = () => {
    if (spaceHeldRef.current || tool === "move") return isPanningRef.current ? "grabbing" : "grab";
    if (tool === "text") return "text";
    if (tool === "eraser") return "cell";
    if (tool === "sticky" || tool === "table") return "copy";
    if (tool === "image") return "pointer";
    if (tool === "laser") return "none";
    return "crosshair";
  };

  const getInputPlaceholder = () => {
    switch (textInput.mode) {
      case "sticky": return "Sticky note text...";
      case "frame": return "Frame label...";
      default: return "Type and press Enter";
    }
  };

  const handleToolSelect = (id: Tool) => {
    setTool(id);
    // Immediately open file picker for image tool
    if (id === "image") {
      // Only open picker if no image is selected
      if (selectedImageIdx === null) {
        setTimeout(() => fileInputRef.current?.click(), 50);
      }
    }
  };

  const ToolBtn = ({ id, icon: Icon, label }: { id: Tool; icon: React.ElementType; label: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => handleToolSelect(id)}
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
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-muted rounded-lg px-1">
            <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom Out" className="h-8 w-8">
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <button onClick={resetView} className="text-xs font-mono min-w-[40px] text-center hover:underline">
              {Math.round(zoom * 100)}%
            </button>
            <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom In" className="h-8 w-8">
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button variant="teacher" size="sm" onClick={openSendModal}>
            <Send className="h-4 w-4" />
            📤 Send to Students
          </Button>

          {isFullscreen && (
            <span className="px-2 py-1 rounded-full bg-teacher/10 text-teacher text-xs font-bold">FULLSCREEN</span>
          )}
        </div>
      </div>

      {/* Select Student dropdown + sent history */}
      <div className="flex items-center gap-3 px-3">
        <select
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm min-w-[180px]"
          value={selectedStudentId || ""}
          onChange={(e) => e.target.value && handleSelectStudent(e.target.value)}
        >
          <option value="" disabled>Select Student...</option>
          {students.map((s) => (
            <option key={s.user_id} value={s.user_id}>{s.student_name}</option>
          ))}
        </select>
        {selectedStudentId && (
          <span className="text-xs text-muted-foreground">
            {sentWhiteboards.length} whiteboard(s) sent
          </span>
        )}
      </div>

      {/* Sent whiteboards list for selected student */}
      {selectedStudentId && (
        <div className="px-3 max-h-36 overflow-y-auto">
          {loadingSent ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-teacher" />
            </div>
          ) : sentWhiteboards.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">No whiteboards sent to this student yet</p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {sentWhiteboards.map((sw) => (
                <div key={sw.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card text-sm">
                  {sw.thumbnail_data && (
                    <img src={sw.thumbnail_data} alt="" className="w-12 h-8 object-contain rounded border border-border bg-white" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-xs truncate max-w-[120px]">{sw.title}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(sw.sent_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editSentWhiteboard(sw)} title="Edit">
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteConfirmId(sw.id)} title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">Double-click canvas to enter/exit fullscreen · Hold Space to pan · Scroll to zoom</p>

      {/* Main area: left tools | canvas | right colors */}
      <div className="flex flex-1 gap-3 px-3 pb-3 min-h-0">
        {/* Left Toolbar */}
        <div className="flex flex-col items-center gap-0.5 py-3 px-1.5 bg-card rounded-2xl shadow-lg border border-border/50 self-start">
          <ToolBtn id="move" icon={Hand} label="Move / Pan" />
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
          <ToolBtn id="sticky" icon={StickyNote} label="Sticky Note" />
          <ToolBtn id="frame" icon={Hash} label="Frame" />
          <ToolBtn id="table" icon={Table2} label="Table (3×3)" />
          <ToolBtn id="image" icon={ImagePlus} label="Image Upload" />

          <div className="w-7 h-px bg-border my-1.5" />

          <ToolBtn id="laser" icon={Crosshair} label="Laser Pointer" />
          <ToolBtn id="eraser" icon={Eraser} label="Eraser" />

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
          className="relative flex-1 rounded-xl border border-border bg-muted/30 shadow-inner overflow-hidden"
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-teacher" />
            </div>
          )}

          {/* Laser dot cursor */}
          {tool === "laser" && (
            <div className="pointer-events-none absolute inset-0 z-20" id="laser-cursor-layer" />
          )}

          <canvas
            ref={canvasRef}
            className="block w-full h-full"
            style={{ cursor: getCursor(), touchAction: "none" }}
            onMouseDown={startDrawing}
            onMouseMove={(e) => {
              draw(e);
              // Update laser trail on move even without clicking
              if (tool === "laser" && !isDrawing) {
                const pos = getCanvasPos(e);
                laserTrailRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
              }
            }}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
          />

          {/* Floating text input */}
          {textInput.visible && (
            <input
              ref={textInputRef}
              className={cn(
                "absolute border-b-2 outline-none px-2 py-1 text-sm shadow-sm rounded",
                textInput.mode === "sticky"
                  ? "bg-yellow-100 border-yellow-400 text-yellow-900"
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

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Whiteboard?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will remove the whiteboard from the student. This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteSentWhiteboard(deleteConfirmId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
