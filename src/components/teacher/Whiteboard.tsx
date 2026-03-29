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
  Pencil, Eraser, Undo2, Redo2, Trash2, Save,
  Type, Loader2,
  Minus, Square, Circle as CircleIcon, Send,
  ArrowUpRight, Spline,
  StickyNote, Hash, Table2, ImagePlus,
  ChevronDown, Hand, Crosshair, ZoomIn, ZoomOut, ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Tool = "move" | "pen" | "eraser" | "line" | "rect" | "circle" | "arrow" | "connector" | "text" | "sticky" | "frame" | "table" | "image" | "laser";

interface Point { x: number; y: number; }

interface Stroke {
  id: string;
  ownerId: string;
  points: Point[];
  color: string;
  size: number;
  tool: "pen" | "eraser";
}

interface ShapeItem {
  id: string;
  ownerId: string;
  type: "line" | "rect" | "circle" | "arrow" | "connector" | "frame";
  start: Point;
  end: Point;
  color: string;
  size: number;
  label?: string;
}

interface TextItem {
  id: string;
  ownerId: string;
  x: number; y: number;
  text: string;
  color: string;
  size: number;
  font?: string;
}

interface StickyNoteItem {
  id: string;
  ownerId: string;
  x: number; y: number;
  text: string;
  bgColor: string;
  width: number;
  height: number;
}

interface TableItem {
  id: string;
  ownerId: string;
  x: number; y: number;
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  color: string;
}

interface ImageItemData {
  id: string;
  ownerId: string;
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

interface PresenceUser {
  user_id: string;
  role: string;
  name: string;
  online_at: string;
}

interface UndoAction {
  type: "stroke" | "shape" | "text" | "sticky" | "table" | "image";
  id: string;
  data: any;
}

interface WhiteboardProps {
  mode?: "teacher" | "student";
  sessionId?: string;
  onBack?: () => void;
}

const COLORS = [
  "#1a1a2e", "#e74c3c", "#2980b9", "#27ae60",
  "#f39c12", "#8e44ad", "#e91e63", "#00bcd4",
  "#ff5722", "#795548", "#607d8b", "#9c27b0",
];

const STICKY_COLORS = ["#fff9c4", "#c8e6c9", "#bbdefb", "#f8bbd0", "#ffe0b2", "#e1bee7"];
const STROKE_SIZES = [2, 4, 6, 10, 16];
const GRID_SIZE = 25;
const LASER_FADE_MS = 1000;

const emptyState = (): WhiteboardState => ({
  strokes: [], shapes: [], texts: [], stickyNotes: [], tables: [], images: [],
});

const uid = () => crypto.randomUUID();
const wb = () => supabase.from("whiteboards" as any);
const sessionsTable = () => supabase.from("whiteboard_sessions" as any);

export function Whiteboard({ mode = "teacher", sessionId, onBack }: WhiteboardProps) {
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

  // Student dropdown + sent history (teacher only)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [sentWhiteboards, setSentWhiteboards] = useState<WhiteboardShare[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Infinite canvas
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const panOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const toolRef = useRef<Tool>("pen");
  const selectedImageIdxRef = useRef<number | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const panOffsetStartRef = useRef<Point>({ x: 0, y: 0 });
  const spaceHeldRef = useRef(false);

  // Image drag/resize
  const [selectedImageIdx, setSelectedImageIdx] = useState<number | null>(null);
  const imageDragRef = useRef<{ idx: number; offsetX: number; offsetY: number; mode: "move" | "resize"; corner?: string } | null>(null);

  // Text/sticky input
  const [textInput, setTextInput] = useState<{ x: number; y: number; visible: boolean; mode: "text" | "sticky" | "frame" }>({ x: 0, y: 0, visible: false, mode: "text" });
  const [textValue, setTextValue] = useState("");
  const [stickyCanvasPos, setStickyCanvasPos] = useState<Point>({ x: 0, y: 0 });

  // Laser
  const laserTrailRef = useRef<LaserPoint[]>([]);
  const laserAnimRef = useRef<number>(0);

  // Send modal (teacher)
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  // Canvas state
  const stateRef = useRef<WhiteboardState>(emptyState());
  const currentStroke = useRef<Stroke | null>(null);
  const shapeStart = useRef<Point | null>(null);
  const shapePreview = useRef<Point | null>(null);
  const [, forceUpdate] = useState(0);

  // === NEW: Realtime collaboration ===
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId || null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteStrokesRef = useRef<Map<string, Stroke>>(new Map());
  const remoteLaserRef = useRef<Map<string, LaserPoint[]>>(new Map());
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [displayName, setDisplayName] = useState("");

  // Personal undo
  const myActionsRef = useRef<UndoAction[]>([]);
  const myRedoRef = useRef<UndoAction[]>([]);

  // Global presence (who's on whiteboard dashboard)
  const globalChannelRef = useRef<RealtimeChannel | null>(null);
  const [globalOnlineStudents, setGlobalOnlineStudents] = useState<{ user_id: string; name: string }[]>([]);

  // Keep refs in sync with state for use in render callback
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { selectedImageIdxRef.current = selectedImageIdx; }, [selectedImageIdx]);

  const getCanvasDims = () => {
    const container = containerRef.current;
    if (!container) return { w: 1920, h: 1080 };
    return { w: container.clientWidth, h: container.clientHeight };
  };

  // Canvas resize
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
      if (e.code === "Space") spaceHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [textInput.visible]);

  // Laser animation loop (local + remote)
  useEffect(() => {
    const hasRemote = activeSessionId != null;
    if (tool !== "laser" && !hasRemote) {
      laserTrailRef.current = [];
      return;
    }
    const animate = () => {
      const now = Date.now();
      if (tool === "laser") {
        laserTrailRef.current = laserTrailRef.current.filter(p => now - p.time < LASER_FADE_MS);
      }
      if (hasRemote) {
        remoteLaserRef.current.forEach((trail, uId) => {
          remoteLaserRef.current.set(uId, trail.filter(p => now - p.time < LASER_FADE_MS));
        });
      }
      render();
      laserAnimRef.current = requestAnimationFrame(animate);
    };
    laserAnimRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(laserAnimRef.current);
  }, [tool, activeSessionId]);

  // Fetch display name
  useEffect(() => {
    if (!user) return;
    const fetchName = async () => {
      if (mode === "student") {
        const { data } = await supabase.from("student_profiles").select("student_name").eq("user_id", user.id).maybeSingle();
        setDisplayName(data?.student_name || "Student");
      } else {
        const { data } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        setDisplayName(data?.full_name || "Teacher");
      }
    };
    fetchName();
  }, [user, mode]);

  // === Global presence channel (shows who's on whiteboard) ===
  useEffect(() => {
    if (!user || !displayName) return;
    const globalChannel = supabase.channel("wb:global", {
      config: { presence: { key: user.id } },
    });

    globalChannel
      .on("presence", { event: "sync" }, () => {
        const state = globalChannel.presenceState();
        const onlineStudents: { user_id: string; name: string }[] = [];
        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((p: any) => {
            if (p.role === "student" && p.user_id !== user.id) {
              onlineStudents.push({ user_id: p.user_id, name: p.name });
            }
          });
        });
        setGlobalOnlineStudents(onlineStudents);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await globalChannel.track({
            user_id: user.id,
            role: mode,
            name: displayName,
            online_at: new Date().toISOString(),
          });
        }
      });

    globalChannelRef.current = globalChannel;

    return () => {
      supabase.removeChannel(globalChannel);
      globalChannelRef.current = null;
    };
  }, [user, displayName, mode]);

  // === Realtime channel ===
  useEffect(() => {
    if (!activeSessionId || !user) return;

    const channel = supabase.channel(`wb:${activeSessionId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((p: any) => {
            if (p.user_id !== user.id) users.push(p);
          });
        });
        setPresenceUsers(users);
      })
      .on("broadcast", { event: "draw" }, ({ payload }: any) => {
        if (payload?.senderId === user.id) return;
        handleRemoteEvent(payload);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            role: mode,
            name: displayName || (mode === "teacher" ? "Teacher" : "Student"),
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [activeSessionId, user, displayName]);

  // Load session state
  useEffect(() => {
    if (!activeSessionId) return;
    const loadSession = async () => {
      setLoading(true);
      try {
        const { data } = await sessionsTable().select("canvas_state").eq("id", activeSessionId).single();
        if ((data as any)?.canvas_state) {
          const parsed = JSON.parse((data as any).canvas_state);
          stateRef.current = {
            strokes: parsed.strokes || [],
            shapes: parsed.shapes || [],
            texts: parsed.texts || [],
            stickyNotes: parsed.stickyNotes || [],
            tables: parsed.tables || [],
            images: parsed.images || [],
          };
          loadedImagesRef.current.clear();
          render();
        }
      } catch (err) {
        console.error("Failed to load session state:", err);
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, [activeSessionId]);

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!activeSessionId) return;
    const interval = setInterval(async () => {
      try {
        await sessionsTable()
          .update({ canvas_state: JSON.stringify(stateRef.current), last_saved_at: new Date().toISOString() } as any)
          .eq("id", activeSessionId);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [activeSessionId]);

  // Immediate save to session DB
  const saveSessionNow = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await sessionsTable()
        .update({ canvas_state: JSON.stringify(stateRef.current), last_saved_at: new Date().toISOString() } as any)
        .eq("id", activeSessionId);
    } catch (err) {
      console.error("Immediate save failed:", err);
    }
  }, [activeSessionId]);

  // Broadcast helper
  const broadcast = useCallback((payload: any) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "draw",
      payload: { ...payload, senderId: user?.id },
    });
  }, [user]);

  // Handle remote events
  const handleRemoteEvent = useCallback((payload: any) => {
    const s = stateRef.current;
    switch (payload.action) {
      case "stroke_progress": {
        let rs = remoteStrokesRef.current.get(payload.strokeId);
        if (!rs) {
          rs = { id: payload.strokeId, ownerId: payload.ownerId, points: [], color: payload.color, size: payload.size, tool: payload.strokeTool };
          remoteStrokesRef.current.set(payload.strokeId, rs);
        }
        rs.points.push(payload.point);
        render();
        break;
      }
      case "stroke_complete": {
        const rs = remoteStrokesRef.current.get(payload.strokeId);
        if (rs) {
          s.strokes.push(rs);
          remoteStrokesRef.current.delete(payload.strokeId);
        }
        render();
        break;
      }
      case "shape_add": s.shapes.push(payload.data); render(); break;
      case "text_add": s.texts.push(payload.data); render(); break;
      case "sticky_add": s.stickyNotes.push(payload.data); render(); break;
      case "table_add": s.tables.push(payload.data); render(); break;
      case "image_add": s.images.push(payload.data); render(); break;
      case "undo": removeById(payload.itemType, payload.itemId); render(); break;
      case "redo": addItem(payload.itemType, payload.data); render(); break;
      case "laser": {
        const trail = remoteLaserRef.current.get(payload.userId) || [];
        trail.push({ x: payload.x, y: payload.y, time: Date.now() });
        remoteLaserRef.current.set(payload.userId, trail);
        break;
      }
      case "clear": {
        s.strokes = s.strokes.filter(i => i.ownerId !== payload.userId);
        s.shapes = s.shapes.filter(i => i.ownerId !== payload.userId);
        s.texts = s.texts.filter(i => i.ownerId !== payload.userId);
        s.stickyNotes = s.stickyNotes.filter(i => i.ownerId !== payload.userId);
        s.tables = s.tables.filter(i => i.ownerId !== payload.userId);
        s.images = s.images.filter(i => i.ownerId !== payload.userId);
        render();
        break;
      }
      case "clear_all": {
        stateRef.current = emptyState();
        loadedImagesRef.current.clear();
        render();
        break;
      }
    }
    forceUpdate(n => n + 1);
  }, []);

  const removeById = (type: string, id: string) => {
    const s = stateRef.current;
    switch (type) {
      case "stroke": s.strokes = s.strokes.filter(i => i.id !== id); break;
      case "shape": s.shapes = s.shapes.filter(i => i.id !== id); break;
      case "text": s.texts = s.texts.filter(i => i.id !== id); break;
      case "sticky": s.stickyNotes = s.stickyNotes.filter(i => i.id !== id); break;
      case "table": s.tables = s.tables.filter(i => i.id !== id); break;
      case "image": s.images = s.images.filter(i => i.id !== id); break;
    }
  };

  const addItem = (type: string, data: any) => {
    const s = stateRef.current;
    switch (type) {
      case "stroke": s.strokes.push(data); break;
      case "shape": s.shapes.push(data); break;
      case "text": s.texts.push(data); break;
      case "sticky": s.stickyNotes.push(data); break;
      case "table": s.tables.push(data); break;
      case "image": s.images.push(data); break;
    }
  };

  const pushAction = (type: UndoAction["type"], id: string, data: any) => {
    myActionsRef.current.push({ type, id, data });
    myRedoRef.current = [];
  };

  const undo = useCallback(() => {
    if (myActionsRef.current.length === 0) return;
    const action = myActionsRef.current.pop()!;
    removeById(action.type, action.id);
    myRedoRef.current.push(action);
    if (activeSessionId) {
      broadcast({ action: "undo", itemType: action.type, itemId: action.id });
      saveSessionNow();
    }
    forceUpdate(n => n + 1);
    render();
  }, [activeSessionId, broadcast, saveSessionNow]);

  const redo = useCallback(() => {
    if (myRedoRef.current.length === 0) return;
    const action = myRedoRef.current.pop()!;
    addItem(action.type, action.data);
    myActionsRef.current.push(action);
    if (activeSessionId) {
      broadcast({ action: "redo", itemType: action.type, itemId: action.id, data: action.data });
      saveSessionNow();
    }
    forceUpdate(n => n + 1);
    render();
  }, [activeSessionId, broadcast, saveSessionNow]);

  const screenToWorld = (screenX: number, screenY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (screenX - rect.left - panOffset.x) / zoom, y: (screenY - rect.top - panOffset.y) / zoom };
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    return screenToWorld(clientX, clientY);
  };

  const getScreenPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // === Drawing helpers (unchanged) ===
  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const z = zoomRef.current;
    const pan = panOffsetRef.current;
    ctx.save();
    ctx.strokeStyle = "#e8edf2";
    ctx.lineWidth = 0.5 / z;
    const canvas = canvasRef.current!;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    const worldLeft = -pan.x / z, worldTop = -pan.y / z;
    const worldRight = worldLeft + w / z, worldBottom = worldTop + h / z;
    const startX = Math.floor(worldLeft / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(worldTop / GRID_SIZE) * GRID_SIZE;
    for (let x = startX; x <= worldRight; x += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(x, worldTop); ctx.lineTo(x, worldBottom); ctx.stroke(); }
    for (let y = startY; y <= worldBottom; y += GRID_SIZE) { ctx.beginPath(); ctx.moveTo(worldLeft, y); ctx.lineTo(worldRight, y); ctx.stroke(); }
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
      ctx.strokeRect(shape.start.x, shape.start.y, shape.end.x - shape.start.x, shape.end.y - shape.start.y);
    } else if (shape.type === "circle") {
      const rx = Math.abs(shape.end.x - shape.start.x) / 2;
      const ry = Math.abs(shape.end.y - shape.start.y) / 2;
      ctx.ellipse((shape.start.x + shape.end.x) / 2, (shape.start.y + shape.end.y) / 2, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape.type === "connector") {
      const midX = (shape.start.x + shape.end.x) / 2;
      ctx.moveTo(shape.start.x, shape.start.y);
      ctx.bezierCurveTo(midX, shape.start.y, midX, shape.end.y, shape.end.x, shape.end.y);
      ctx.stroke();
      ctx.fillStyle = shape.color;
      ctx.beginPath(); ctx.arc(shape.start.x, shape.start.y, shape.size + 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(shape.end.x, shape.end.y, shape.size + 2, 0, Math.PI * 2); ctx.fill();
    } else if (shape.type === "frame") {
      ctx.setLineDash([10, 6]);
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2;
      const x = Math.min(shape.start.x, shape.end.x), y = Math.min(shape.start.y, shape.end.y);
      const fw = Math.abs(shape.end.x - shape.start.x), fh = Math.abs(shape.end.y - shape.start.y);
      ctx.strokeRect(x, y, fw, fh);
      ctx.setLineDash([]);
      if (shape.label) { ctx.font = "bold 18px 'Inter', sans-serif"; ctx.fillStyle = shape.color; ctx.fillText(shape.label, x + 8, y - 8); }
    }
    ctx.restore();
  };

  const drawStickyNote = (ctx: CanvasRenderingContext2D, note: StickyNoteItem) => {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.15)"; ctx.shadowBlur = 8; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 4;
    ctx.fillStyle = note.bgColor;
    ctx.fillRect(note.x, note.y, note.width, note.height);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 1;
    ctx.strokeRect(note.x, note.y, note.width, note.height);
    ctx.fillStyle = "#333333"; ctx.font = "16px 'Inter', sans-serif";
    const lines = wrapText(ctx, note.text, note.width - 20);
    lines.forEach((line, i) => { ctx.fillText(line, note.x + 10, note.y + 28 + i * 22); });
    ctx.restore();
  };

  const drawTable = (ctx: CanvasRenderingContext2D, table: TableItem) => {
    ctx.save();
    ctx.strokeStyle = table.color; ctx.lineWidth = 1.5;
    const totalW = table.cols * table.cellWidth, totalH = table.rows * table.cellHeight;
    ctx.fillStyle = table.color + "18";
    ctx.fillRect(table.x, table.y, totalW, table.cellHeight);
    for (let r = 0; r <= table.rows; r++) { ctx.beginPath(); ctx.moveTo(table.x, table.y + r * table.cellHeight); ctx.lineTo(table.x + totalW, table.y + r * table.cellHeight); ctx.stroke(); }
    for (let c = 0; c <= table.cols; c++) { ctx.beginPath(); ctx.moveTo(table.x + c * table.cellWidth, table.y); ctx.lineTo(table.x + c * table.cellWidth, table.y + totalH); ctx.stroke(); }
    ctx.restore();
  };

  const drawImageItem = (ctx: CanvasRenderingContext2D, item: ImageItemData, idx: number) => {
    const cached = loadedImagesRef.current.get(item.dataUrl);
    if (cached) {
      ctx.drawImage(cached, item.x, item.y, item.width, item.height);
      const selImg = selectedImageIdxRef.current;
      const z = zoomRef.current;
      if (selImg === idx) {
        ctx.save();
        ctx.strokeStyle = "#2980b9"; ctx.lineWidth = 2 / z; ctx.setLineDash([6 / z, 4 / z]);
        ctx.strokeRect(item.x, item.y, item.width, item.height);
        ctx.setLineDash([]);
        const hs = 8 / z;
        ctx.fillStyle = "#2980b9";
        for (const c of [{ x: item.x, y: item.y }, { x: item.x + item.width, y: item.y }, { x: item.x, y: item.y + item.height }, { x: item.x + item.width, y: item.y + item.height }]) {
          ctx.fillRect(c.x - hs / 2, c.y - hs / 2, hs, hs);
        }
        ctx.restore();
      }
    } else {
      const img = new Image();
      img.onload = () => { loadedImagesRef.current.set(item.dataUrl, img); render(); };
      img.src = item.dataUrl;
    }
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) { lines.push(currentLine); currentLine = word; }
      else currentLine = testLine;
    }
    if (currentLine) lines.push(currentLine);
    return lines.length ? lines : [""];
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke) => {
    if (s.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.strokeStyle = s.tool === "eraser" ? "#ffffff" : s.color;
    ctx.lineWidth = s.tool === "eraser" ? s.size * 4 : s.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  // === Render ===
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr, h = canvas.height / dpr;
    const currentPan = panOffsetRef.current;
    const currentZoom = zoomRef.current;
    const currentTool = toolRef.current;
    const currentSelectedImg = selectedImageIdxRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(currentPan.x, currentPan.y);
    ctx.scale(currentZoom, currentZoom);

    drawGrid(ctx);

    const { strokes, shapes, texts, stickyNotes, tables, images } = stateRef.current;
    images.forEach((img, idx) => drawImageItem(ctx, img, idx));
    for (const s of strokes) drawStroke(ctx, s);
    for (const shape of shapes) drawShape(ctx, shape);

    // Current local stroke
    if (currentStroke.current && currentStroke.current.points.length >= 2) {
      drawStroke(ctx, currentStroke.current);
    }

    // Remote in-progress strokes
    remoteStrokesRef.current.forEach(rs => drawStroke(ctx, rs));

    // Shape preview
    if (shapeStart.current && shapePreview.current) {
      const shapeTool = currentTool as string;
      if (["line", "rect", "circle", "arrow", "connector", "frame"].includes(shapeTool)) {
        drawShape(ctx, {
          id: "", ownerId: "",
          type: shapeTool as ShapeItem["type"],
          start: shapeStart.current, end: shapePreview.current,
          color, size: strokeSize,
          label: shapeTool === "frame" ? "Frame" : undefined,
        });
      }
    }

    for (const t of tables) drawTable(ctx, t);
    for (const note of stickyNotes) drawStickyNote(ctx, note);
    for (const t of texts) {
      ctx.font = t.font || `${t.size * 4 + 14}px 'Inter', sans-serif`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.restore();

    // Local laser trail (red)
    if (currentTool === "laser" && laserTrailRef.current.length > 0) {
      const now = Date.now();
      for (const p of laserTrailRef.current) {
        const alpha = Math.max(0, 1 - (now - p.time) / LASER_FADE_MS);
        const r = 6 * alpha + 2;
        const sx = p.x * currentZoom + currentPan.x, sy = p.y * currentZoom + currentPan.y;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 30, 30, ${alpha * 0.9})`; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 30, 30, ${alpha * 0.2})`; ctx.fill();
      }
    }

    // Remote laser trails (blue)
    remoteLaserRef.current.forEach((trail) => {
      const now = Date.now();
      for (const p of trail) {
        const alpha = Math.max(0, 1 - (now - p.time) / LASER_FADE_MS);
        const r = 6 * alpha + 2;
        const sx = p.x * currentZoom + currentPan.x, sy = p.y * currentZoom + currentPan.y;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(30, 100, 255, ${alpha * 0.9})`; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(30, 100, 255, ${alpha * 0.2})`; ctx.fill();
      }
    });
  }, [tool, color, strokeSize, panOffset, zoom, selectedImageIdx]);

  // Initial render + first action (for undo baseline)
  useEffect(() => { render(); }, []);
  useEffect(() => { render(); }, [panOffset, zoom, selectedImageIdx]);

  useEffect(() => {
    if (user && mode === "teacher") {
      fetchSavedBoards();
      fetchStudents();
    }
  }, [user, mode]);

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
    setLoading(true);
    try {
      // Find or create session for collaboration
      const { data: existingSession } = await sessionsTable()
        .select("id, canvas_state")
        .eq("whiteboard_id", share.whiteboard_id)
        .eq("student_user_id", share.student_user_id)
        .eq("is_active", true)
        .maybeSingle();

      if (existingSession) {
        // Load from session state (includes student drawings)
        const sessionData = existingSession as any;
        if (sessionData.canvas_state) {
          try {
            const parsed = JSON.parse(sessionData.canvas_state);
            stateRef.current = {
              strokes: parsed.strokes || [], shapes: parsed.shapes || [],
              texts: parsed.texts || [], stickyNotes: parsed.stickyNotes || [],
              tables: parsed.tables || [], images: parsed.images || [],
            };
          } catch { stateRef.current = emptyState(); }
        }
        setTitle(share.title);
        setCurrentBoardId(share.whiteboard_id);
        loadedImagesRef.current.clear();
        setSelectedImageIdx(null);
        setPanOffset({ x: 0, y: 0 });
        setZoom(1);
        myActionsRef.current = [];
        myRedoRef.current = [];
        setActiveSessionId(sessionData.id);
        forceUpdate(n => n + 1);
        render();
      } else {
        // No session exists yet — load original board and create session
        await loadBoard(share.whiteboard_id);
        const { data: newSession } = await sessionsTable()
          .insert({
            whiteboard_id: share.whiteboard_id,
            teacher_user_id: user!.id,
            student_user_id: share.student_user_id,
            canvas_state: JSON.stringify(stateRef.current),
          } as any)
          .select("id")
          .single();
        if (newSession) setActiveSessionId((newSession as any).id);
      }
    } catch (err) {
      console.error("Failed to setup session:", err);
    } finally {
      setLoading(false);
    }
  };

  const clearCanvas = () => {
    if (activeSessionId && user) {
      // Clear ALL items on the canvas (full clear syncs to other user)
      stateRef.current = emptyState();
      myActionsRef.current = [];
      myRedoRef.current = [];
      broadcast({ action: "clear_all" });
      saveSessionNow();
    } else {
      stateRef.current = emptyState();
      myActionsRef.current = [];
      myRedoRef.current = [];
    }
    loadedImagesRef.current.clear();
    setSelectedImageIdx(null);
    forceUpdate(n => n + 1);
    render();
  };

  const isShapeTool = (t: Tool) => ["line", "rect", "circle", "arrow", "connector", "frame"].includes(t);

  const hitTestImage = (worldPos: Point): number | null => {
    const images = stateRef.current.images;
    for (let i = images.length - 1; i >= 0; i--) {
      const img = images[i];
      if (worldPos.x >= img.x && worldPos.x <= img.x + img.width && worldPos.y >= img.y && worldPos.y <= img.y + img.height) return i;
    }
    return null;
  };

  const hitTestImageCorner = (worldPos: Point): string | null => {
    if (selectedImageIdx === null) return null;
    const img = stateRef.current.images[selectedImageIdx];
    if (!img) return null;
    const hs = 12 / zoom;
    for (const c of [
      { name: "tl", x: img.x, y: img.y }, { name: "tr", x: img.x + img.width, y: img.y },
      { name: "bl", x: img.x, y: img.y + img.height }, { name: "br", x: img.x + img.width, y: img.y + img.height },
    ]) {
      if (Math.abs(worldPos.x - c.x) < hs && Math.abs(worldPos.y - c.y) < hs) return c.name;
    }
    return null;
  };

  // === Mouse handlers ===
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const pos = getCanvasPos(e);
    const screenPos = getScreenPos(e);
    const isMiddleButton = "button" in e && (e as React.MouseEvent).button === 1;

    if (spaceHeldRef.current || tool === "move" || isMiddleButton) {
      e.preventDefault();
      isPanningRef.current = true;
      let clientX: number, clientY: number;
      if ("touches" in e && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
      panStartRef.current = { x: clientX, y: clientY };
      panOffsetStartRef.current = { ...panOffset };
      return;
    }

    if (tool === "laser") {
      e.preventDefault();
      setIsDrawing(true);
      laserTrailRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
      if (activeSessionId) broadcast({ action: "laser", x: pos.x, y: pos.y, userId: user?.id });
      return;
    }

    if (tool === "image") {
      const corner = hitTestImageCorner(pos);
      if (corner && selectedImageIdx !== null) {
        imageDragRef.current = { idx: selectedImageIdx, offsetX: pos.x, offsetY: pos.y, mode: "resize", corner };
        setIsDrawing(true);
        e.preventDefault();
        return;
      }
      const imgIdx = hitTestImage(pos);
      if (imgIdx !== null) {
        const img = stateRef.current.images[imgIdx];
        setSelectedImageIdx(imgIdx);
        imageDragRef.current = { idx: imgIdx, offsetX: pos.x - img.x, offsetY: pos.y - img.y, mode: "move" };
        setIsDrawing(true);
        e.preventDefault();
        return;
      }
      setSelectedImageIdx(null);
      fileInputRef.current?.click();
      return;
    }

    setSelectedImageIdx(null);

    if (tool === "table") {
      const item: TableItem = { id: uid(), ownerId: user?.id || "", x: pos.x, y: pos.y, rows: 3, cols: 3, cellWidth: 120, cellHeight: 40, color };
      stateRef.current.tables.push(item);
      pushAction("table", item.id, item);
      if (activeSessionId) broadcast({ action: "table_add", data: item });
      forceUpdate(n => n + 1);
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
      id: uid(),
      ownerId: user?.id || "",
      points: [pos],
      color,
      size: strokeSize,
      tool: tool === "eraser" ? "eraser" : "pen",
    };
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanningRef.current) {
      let clientX: number, clientY: number;
      if ("touches" in e && e.touches.length > 0) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
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
      if (activeSessionId) broadcast({ action: "laser", x: pos.x, y: pos.y, userId: user?.id });
      return;
    }

    if (imageDragRef.current) {
      const ref = imageDragRef.current;
      const img = stateRef.current.images[ref.idx];
      if (!img) return;
      if (ref.mode === "move") { img.x = pos.x - ref.offsetX; img.y = pos.y - ref.offsetY; }
      else if (ref.mode === "resize" && ref.corner) {
        const corner = ref.corner;
        if (corner === "br") { img.width = Math.max(30, pos.x - img.x); img.height = Math.max(30, pos.y - img.y); }
        else if (corner === "bl") { const nw = Math.max(30, (img.x + img.width) - pos.x); img.x = img.x + img.width - nw; img.width = nw; img.height = Math.max(30, pos.y - img.y); }
        else if (corner === "tr") { img.width = Math.max(30, pos.x - img.x); const nh = Math.max(30, (img.y + img.height) - pos.y); img.y = img.y + img.height - nh; img.height = nh; }
        else if (corner === "tl") { const nw = Math.max(30, (img.x + img.width) - pos.x); const nh = Math.max(30, (img.y + img.height) - pos.y); img.x = img.x + img.width - nw; img.y = img.y + img.height - nh; img.width = nw; img.height = nh; }
      }
      if (activeSessionId) {
        broadcast({ action: "image_update", data: { id: img.id, x: img.x, y: img.y, width: img.width, height: img.height } });
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
      if (activeSessionId) {
        broadcast({
          action: "stroke_progress",
          strokeId: currentStroke.current.id,
          point: pos,
          color: currentStroke.current.color,
          size: currentStroke.current.size,
          strokeTool: currentStroke.current.tool,
          ownerId: currentStroke.current.ownerId,
        });
      }
      render();
    }
  };

  const stopDrawing = () => {
    if (isPanningRef.current) { isPanningRef.current = false; return; }
    if (tool === "laser") { setIsDrawing(false); return; }

    if (imageDragRef.current) {
      imageDragRef.current = null;
      setIsDrawing(false);
      render();
      return;
    }

    if (!isDrawing) return;

    if (isShapeTool(tool) && shapeStart.current && shapePreview.current) {
      const shape: ShapeItem = {
        id: uid(), ownerId: user?.id || "",
        type: (tool === "frame" ? "frame" : tool) as ShapeItem["type"],
        start: shapeStart.current, end: shapePreview.current,
        color, size: strokeSize,
        label: tool === "frame" ? "Frame" : undefined,
      };
      stateRef.current.shapes.push(shape);
      pushAction("shape", shape.id, shape);
      if (activeSessionId) broadcast({ action: "shape_add", data: shape });
      shapeStart.current = null;
      shapePreview.current = null;
      setIsDrawing(false);
      forceUpdate(n => n + 1);
      render();
      return;
    }

    if (currentStroke.current) {
      const stroke = currentStroke.current;
      stateRef.current.strokes.push(stroke);
      pushAction("stroke", stroke.id, stroke);
      if (activeSessionId) broadcast({ action: "stroke_complete", strokeId: stroke.id });
      currentStroke.current = null;
      setIsDrawing(false);
      forceUpdate(n => n + 1);
      render();
    }
  };

  const commitText = () => {
    if (!textValue.trim()) { setTextInput({ ...textInput, visible: false }); return; }
    const pos = stickyCanvasPos;

    if (textInput.mode === "text") {
      const item: TextItem = { id: uid(), ownerId: user?.id || "", x: pos.x, y: pos.y, text: textValue, color, size: strokeSize };
      stateRef.current.texts.push(item);
      pushAction("text", item.id, item);
      if (activeSessionId) broadcast({ action: "text_add", data: item });
    } else if (textInput.mode === "sticky") {
      const bgColor = STICKY_COLORS[stateRef.current.stickyNotes.length % STICKY_COLORS.length];
      const item: StickyNoteItem = { id: uid(), ownerId: user?.id || "", x: pos.x, y: pos.y, text: textValue, bgColor, width: 200, height: 150 };
      stateRef.current.stickyNotes.push(item);
      pushAction("sticky", item.id, item);
      if (activeSessionId) broadcast({ action: "sticky_add", data: item });
    }

    setTextInput({ ...textInput, visible: false });
    setTextValue("");
    forceUpdate(n => n + 1);
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
        let w = img.width, h = img.height;
        const maxDim = 600;
        if (w > maxDim || h > maxDim) { const scale = maxDim / Math.max(w, h); w *= scale; h *= scale; }
        loadedImagesRef.current.set(dataUrl, img);
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const viewW = (canvas?.width || 1920) / dpr, viewH = (canvas?.height || 1080) / dpr;
        const cx = (-panOffset.x + viewW / 2) / zoom - w / 2;
        const cy = (-panOffset.y + viewH / 2) / zoom - h / 2;
        const item: ImageItemData = { id: uid(), ownerId: user?.id || "", x: cx, y: cy, width: w, height: h, dataUrl };
        const newIdx = stateRef.current.images.length;
        stateRef.current.images.push(item);
        setSelectedImageIdx(newIdx);
        pushAction("image", item.id, item);
        if (activeSessionId) broadcast({ action: "image_add", data: item });
        forceUpdate(n => n + 1);
        render();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(10, Math.max(0.1, zoom * zoomFactor));
    setPanOffset({ x: mouseX - (mouseX - panOffset.x) * (newZoom / zoom), y: mouseY - (mouseY - panOffset.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  const handleDoubleClick = () => setIsFullscreen(prev => !prev);

  const zoomIn = () => {
    const newZoom = Math.min(10, zoom * 1.25);
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas?.width || 1920) / dpr, h = (canvas?.height || 1080) / dpr;
    const cx = w / 2, cy = h / 2;
    setPanOffset({ x: cx - (cx - panOffset.x) * (newZoom / zoom), y: cy - (cy - panOffset.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  const zoomOut = () => {
    const newZoom = Math.max(0.1, zoom / 1.25);
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas?.width || 1920) / dpr, h = (canvas?.height || 1080) / dpr;
    const cx = w / 2, cy = h / 2;
    setPanOffset({ x: cx - (cx - panOffset.x) * (newZoom / zoom), y: cy - (cy - panOffset.y) * (newZoom / zoom) });
    setZoom(newZoom);
  };

  const resetView = () => { setPanOffset({ x: 0, y: 0 }); setZoom(1); };

  const saveToDatabase = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { title, image_data: JSON.stringify(stateRef.current), updated_at: new Date().toISOString() };
      if (currentBoardId) {
        const { error } = await wb().update(payload as any).eq("id", currentBoardId);
        if (error) throw error;
      } else {
        const { data, error } = await wb().insert({ teacher_user_id: user.id, ...payload } as any).select("id").single();
        if (error) throw error;
        setCurrentBoardId((data as any).id);
      }
      toast({ title: "Saved", description: "Whiteboard saved successfully." });
      if (mode === "teacher") fetchSavedBoards();
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
          strokes: parsed.strokes || [], shapes: parsed.shapes || [],
          texts: parsed.texts || [], stickyNotes: parsed.stickyNotes || [],
          tables: parsed.tables || [], images: parsed.images || [],
        };
      } catch {
        stateRef.current = emptyState();
      }
      setTitle(board.title);
      setCurrentBoardId(board.id);
      loadedImagesRef.current.clear();
      setSelectedImageIdx(null);
      setPanOffset({ x: 0, y: 0 });
      setZoom(1);
      myActionsRef.current = [];
      myRedoRef.current = [];
      forceUpdate(n => n + 1);
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
    setActiveSessionId(null);
    stateRef.current = emptyState();
    loadedImagesRef.current.clear();
    setSelectedImageIdx(null);
    myActionsRef.current = [];
    myRedoRef.current = [];
    setPanOffset({ x: 0, y: 0 });
    setZoom(1);
    forceUpdate(n => n + 1);
    render();
  };

  const openSendModal = () => { fetchStudents(); setSelectedStudents(new Set()); setSendModalOpen(true); };
  const toggleStudent = (id: string) => { setSelectedStudents(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const toggleAll = () => { if (selectedStudents.size === students.length) setSelectedStudents(new Set()); else setSelectedStudents(new Set(students.map(s => s.user_id))); };

  const sendToStudents = async () => {
    if (!user || selectedStudents.size === 0) return;
    setSending(true);
    try {
      if (!currentBoardId) await saveToDatabase();
      const thumbnail = getThumbnail();
      const shares = Array.from(selectedStudents).map(studentId => ({
        whiteboard_id: currentBoardId,
        student_user_id: studentId,
        teacher_user_id: user.id,
        title,
        thumbnail_data: thumbnail,
      }));
      const { error: shareError } = await supabase.from("whiteboard_shares" as any).insert(shares as any);
      if (shareError) throw shareError;

      // Create sessions for collaboration
      const sessions = Array.from(selectedStudents).map(studentId => ({
        whiteboard_id: currentBoardId,
        student_user_id: studentId,
        teacher_user_id: user.id,
        canvas_state: JSON.stringify(stateRef.current),
      }));
      await sessionsTable().insert(sessions as any);

      // Notifications
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

  const canUndo = myActionsRef.current.length > 0;
  const canRedo = myRedoRef.current.length > 0;

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
    if (id === "image" && selectedImageIdx === null) {
      setTimeout(() => fileInputRef.current?.click(), 50);
    }
  };

  const roleAccent = mode === "student" ? "student" : "teacher";

  const ToolBtn = ({ id, icon: Icon, label }: { id: Tool; icon: React.ElementType; label: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => handleToolSelect(id)}
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
            tool === id
              ? `bg-${roleAccent}/10 border-2 border-${roleAccent} text-${roleAccent} shadow-sm`
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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-3 pt-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          {mode === "student" && onBack && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold max-w-[200px]"
            placeholder="Whiteboard title..."
            readOnly={mode === "student"}
          />
          {mode === "teacher" && (
            <>
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
                  {savedBoards.map((b) => (<option key={b.id} value={b.id}>{b.title}</option>))}
                </select>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} title="Undo"><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} title="Redo"><Redo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={clearCanvas} title="Clear Board"><Trash2 className="h-4 w-4" /></Button>
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg px-1">
            <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom Out" className="h-8 w-8"><ZoomOut className="h-3.5 w-3.5" /></Button>
            <button onClick={resetView} className="text-xs font-mono min-w-[40px] text-center hover:underline">{Math.round(zoom * 100)}%</button>
            <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom In" className="h-8 w-8"><ZoomIn className="h-3.5 w-3.5" /></Button>
          </div>

          {mode === "teacher" && (
            <Button variant="teacher" size="sm" onClick={openSendModal}>
              <Send className="h-4 w-4" /> 📤 Send to Students
            </Button>
          )}

          {activeSessionId && (
            <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-bold animate-pulse">● LIVE</span>
          )}

          {isFullscreen && (
            <span className={`px-2 py-1 rounded-full bg-${roleAccent}/10 text-${roleAccent} text-xs font-bold`}>FULLSCREEN</span>
          )}

          {/* Live students indicator (teacher only) */}
          {mode === "teacher" && globalOnlineStudents.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent border border-border">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-semibold text-foreground">{globalOnlineStudents.length} Live</span>
              <div className="flex -space-x-1.5 ml-1">
                {globalOnlineStudents.slice(0, 5).map((s) => (
                  <div key={s.user_id} className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold border-2 border-background" title={s.name}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {globalOnlineStudents.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-bold border-2 border-background">
                    +{globalOnlineStudents.length - 5}
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-1 text-xs text-muted-foreground hover:text-foreground"><ChevronDown className="h-3 w-3" /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[160px]">
                  {globalOnlineStudents.map((s) => (
                    <DropdownMenuItem key={s.user_id} className="text-sm">
                      <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                      {s.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Select Student dropdown + sent history (teacher only) */}
      {mode === "teacher" && (
        <>
          <div className="flex items-center gap-3 px-3">
            <select
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm min-w-[180px]"
              value={selectedStudentId || ""}
              onChange={(e) => e.target.value && handleSelectStudent(e.target.value)}
            >
              <option value="" disabled>Select Student...</option>
              {students.map((s) => (<option key={s.user_id} value={s.user_id}>{s.student_name}</option>))}
            </select>
            {selectedStudentId && (
              <span className="text-xs text-muted-foreground">{sentWhiteboards.length} whiteboard(s) sent</span>
            )}
          </div>

          {selectedStudentId && (
            <div className="px-3 max-h-36 overflow-y-auto">
              {loadingSent ? (
                <div className="flex items-center justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-teacher" /></div>
              ) : sentWhiteboards.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">No whiteboards sent to this student yet</p>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {sentWhiteboards.map((sw) => (
                    <div key={sw.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card text-sm">
                      {sw.thumbnail_data && (<img src={sw.thumbnail_data} alt="" className="w-12 h-8 object-contain rounded border border-border bg-white" />)}
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate max-w-[120px]">{sw.title}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(sw.sent_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => editSentWhiteboard(sw)} title="Edit"><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteConfirmId(sw.id)} title="Delete"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground text-center">Double-click canvas to enter/exit fullscreen · Hold Space to pan · Scroll to zoom</p>

      {/* Main area */}
      <div className="flex flex-1 gap-3 px-3 pb-3 min-h-0">
        {/* Left Toolbar */}
        <div className="flex flex-col items-center gap-0.5 py-3 px-1.5 bg-card rounded-2xl shadow-lg border border-border/50 self-start">
          <ToolBtn id="move" icon={Hand} label="Move / Pan" />
          <ToolBtn id="pen" icon={Pencil} label="Pen" />

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all relative",
                    activeShapeTool
                      ? `bg-${roleAccent}/10 border-2 border-${roleAccent} text-${roleAccent} shadow-sm`
                      : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
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
                  <s.icon className="h-4 w-4" />{s.label}
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
                      ? `bg-${roleAccent}/10 border-2 border-${roleAccent}`
                      : "bg-transparent hover:bg-muted"
                  )}
                >
                  <span className="rounded-full bg-foreground" style={{ width: Math.min(s * 1.5, 20), height: Math.min(s * 1.5, 20) }} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Size {s}px</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="relative flex-1 rounded-xl border border-border bg-muted/30 shadow-inner overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <Loader2 className={`h-8 w-8 animate-spin text-${roleAccent}`} />
            </div>
          )}

          {/* Presence dots */}
          {presenceUsers.length > 0 && (
            <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
              {presenceUsers.map((pu) => (
                <div key={pu.user_id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/90 border border-border shadow-sm backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium">{pu.role === "teacher" ? "Teacher" : pu.name}</span>
                </div>
              ))}
              {/* Show self */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-card/90 border border-border shadow-sm backdrop-blur-sm opacity-60">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium">You ({mode === "teacher" ? "Teacher" : displayName})</span>
              </div>
            </div>
          )}

          {tool === "laser" && <div className="pointer-events-none absolute inset-0 z-20" />}

          <canvas
            ref={canvasRef}
            className="block w-full h-full"
            style={{ cursor: getCursor(), touchAction: "none" }}
            onMouseDown={startDrawing}
            onMouseMove={(e) => {
              draw(e);
              if (tool === "laser" && !isDrawing) {
                const pos = getCanvasPos(e);
                laserTrailRef.current.push({ x: pos.x, y: pos.y, time: Date.now() });
                if (activeSessionId) broadcast({ action: "laser", x: pos.x, y: pos.y, userId: user?.id });
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

          {textInput.visible && (
            <input
              ref={textInputRef}
              className={cn(
                "absolute border-b-2 outline-none px-2 py-1 text-sm shadow-sm rounded",
                textInput.mode === "sticky" ? "bg-yellow-100 border-yellow-400 text-yellow-900" : `bg-transparent border-${roleAccent} text-foreground`
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
                color === c ? `ring-2 ring-${roleAccent} ring-offset-2 ring-offset-background scale-110 border-${roleAccent}` : "border-border"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="border-t border-border my-1" />
          <label className="w-8 h-8 rounded-full border-2 border-border overflow-hidden cursor-pointer hover:scale-110 transition-transform relative" title="Custom color">
            <input type="color" value={customColor} onChange={(e) => { setCustomColor(e.target.value); setColor(e.target.value); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            <span className="block w-full h-full rounded-full" style={{ background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` }} />
          </label>
        </div>
      </div>

      {/* Send to Students Modal (teacher only) */}
      {mode === "teacher" && (
        <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>📤 Send Whiteboard to Students</DialogTitle></DialogHeader>
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
      )}

      {/* Delete Confirm Dialog (teacher only) */}
      {mode === "teacher" && (
        <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Whiteboard?</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will remove the whiteboard from the student. This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteConfirmId && deleteSentWhiteboard(deleteConfirmId)}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </TooltipProvider>
  );
}
