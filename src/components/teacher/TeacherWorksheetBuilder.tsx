import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Download, RefreshCw, AlertTriangle, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractSourceFiles } from "@/lib/extractSource";
import shobsLogo from "@/assets/shobs-academy-logo.png";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Question {
  number: number;
  type: "mcq" | "short_answer" | "fill_blank" | "numerical" | "true_false" | "diagram" | "part_question";
  prompt: string;
  options?: string[];
  answer?: string;
  parts?: { label: string; prompt: string; marks?: number; answer?: string }[];
  diagram?: {
    type: "triangle" | "circle" | "graph_axes" | "right_angle_triangle" | "number_line" | "bar_chart" | "pie_chart" | "geometric_shape";
    labels?: Record<string, string>;
    dimensions?: Record<string, string | number>;
    instructions?: string;
  };
  marks?: number;
  working?: string;
}

interface Worksheet {
  worksheet_title: string;
  instructions: string;
  questions: Question[];
}

const QUESTION_TYPES = [
  { id: "mcq", label: "Multiple Choice" },
  { id: "short_answer", label: "Short Answer" },
  { id: "fill_blank", label: "Fill in the Blank" },
  { id: "numerical", label: "Numerical" },
  { id: "true_false", label: "True/False" },
  { id: "diagram", label: "Diagram" },
  { id: "part_question", label: "Part Question (a)(b)(c)" },
];

const DIFFICULTY_OPTIONS = [
  "Easy to Hard",
  "Hard to Easy",
  "Medium to Hard",
  "Medium to Easy",
  "Easy only",
  "Hard only",
  "Medium only",
];

export function TeacherWorksheetBuilder() {
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("Easy to Hard");
  const [types, setTypes] = useState<string[]>(["mcq", "short_answer"]);
  const [objective, setObjective] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);

  const toggleType = (id: string) => {
    setTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const allowed = list.filter((f) => /\.(pdf|png|jpe?g)$/i.test(f.name) && f.size <= 20 * 1024 * 1024);
    if (allowed.length !== list.length) {
      toast({ title: "Some files skipped", description: "Only PDF / PNG / JPG up to 20MB each.", variant: "destructive" });
    }
    setFiles((prev) => [...prev, ...allowed]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleGenerate = async () => {
    if (!subject || !grade || !topic || types.length === 0) {
      toast({ title: "Missing fields", description: "Subject, grade, topic and at least one question type are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { text: extractedText, images } = files.length ? await extractSourceFiles(files) : { text: "", images: [] as string[] };
      const combinedText = [pastedText.trim(), extractedText.trim()].filter(Boolean).join("\n\n");
      const { data, error } = await supabase.functions.invoke("generate-worksheet", {
        body: {
          subject, grade, topic,
          count: Number(count),
          difficulty,
          types: types.map((t) => QUESTION_TYPES.find((q) => q.id === t)?.label ?? t),
          objective,
          text: combinedText,
          images,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const ws = (data as any).worksheet as Worksheet;
      if (!ws?.questions?.length) throw new Error("Generation failed — try a more specific topic.");
      setWorksheet(ws);
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message ?? "Try a more specific topic.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const urlToDataUrl = async (url: string): Promise<string | null> => {
    try {
      const r = await fetch(url);
      const b = await r.blob();
      return await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.onerror = rej;
        fr.readAsDataURL(b);
      });
    } catch {
      return null;
    }
  };

  const handleDownloadPDF = async () => {
    if (!worksheet || downloading) return;
    setDownloading(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 210;
      const pageH = 297;
      const marginX = 18;
      const marginTop = 18;
      const marginBottom = 18;
      const contentW = pageW - marginX * 2;
      let y = marginTop;

      const ensureSpace = (h: number) => {
        if (y + h > pageH - marginBottom) {
          pdf.addPage();
          y = marginTop;
        }
      };

      const writeWrapped = (
        text: string,
        opts: { size?: number; style?: "normal" | "bold" | "italic"; font?: "helvetica" | "times" | "courier"; indent?: number; lineGap?: number } = {}
      ) => {
        const size = opts.size ?? 11;
        const style = opts.style ?? "normal";
        const font = opts.font ?? "helvetica";
        const indent = opts.indent ?? 0;
        const lineGap = opts.lineGap ?? 1.4;
        pdf.setFont(font, style);
        pdf.setFontSize(size);
        const lineH = (size * 0.3528) * lineGap;
        const lines = pdf.splitTextToSize(text, contentW - indent);
        for (const ln of lines) {
          ensureSpace(lineH);
          pdf.text(ln, marginX + indent, y);
          y += lineH;
        }
      };

      // Header with logo
      const logoData = await urlToDataUrl(shobsLogo);
      if (logoData) {
        try { pdf.addImage(logoData, "PNG", marginX, y, 18, 18); } catch {}
      }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("SHOBS ACADEMY", pageW - marginX, y + 11, { align: "right" });
      y += 22;
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.6);
      pdf.line(marginX, y, pageW - marginX, y);
      y += 6;

      // Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      const titleLines = pdf.splitTextToSize(worksheet.worksheet_title || "Worksheet", contentW);
      for (const ln of titleLines) {
        ensureSpace(8);
        pdf.text(ln, pageW / 2, y, { align: "center" });
        y += 7;
      }
      y += 2;

      // Student info row
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const infoY = y;
      pdf.text("Name: __________________________", marginX, infoY);
      pdf.text("Date: ______________", marginX + 90, infoY);
      pdf.text("Grade: __________", marginX + 140, infoY);
      y += 8;

      // Instructions
      if (worksheet.instructions) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        ensureSpace(5);
        pdf.text("Instructions:", marginX, y);
        y += 4.5;
        writeWrapped(worksheet.instructions, { size: 10, style: "italic" });
        y += 2;
      }

      // Diagram rasterizer (small per-element JPEG)
      const rasterizeDiagram = async (num: number): Promise<{ data: string; w: number; h: number } | null> => {
        const el = docRef.current?.querySelector(`[data-diagram-q="${num}"]`) as HTMLElement | null;
        if (!el) return null;
        try {
          const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: "#ffffff", logging: false });
          const data = canvas.toDataURL("image/jpeg", 0.7);
          const ratio = canvas.height / canvas.width;
          const wMm = Math.min(90, contentW);
          return { data, w: wMm, h: wMm * ratio };
        } catch {
          return null;
        }
      };

      // Questions
      for (const q of worksheet.questions) {
        y += 2;
        const marks = typeof q.marks === "number" && q.marks > 0 ? ` [${q.marks} mark${q.marks === 1 ? "" : "s"}]` : "";
        writeWrapped(`${q.number}. ${q.prompt}${marks}`, { size: 11, style: "bold" });

        if (q.type === "mcq" && q.options?.length) {
          for (const opt of q.options) writeWrapped(opt, { size: 10, indent: 8 });
        }

        if (q.type === "true_false") {
          writeWrapped("◯ True     ◯ False", { size: 10, indent: 8 });
        }

        if (q.type === "short_answer" || q.type === "numerical") {
          const lines = q.type === "short_answer" ? 3 : 2;
          for (let i = 0; i < lines; i++) {
            ensureSpace(8);
            y += 5;
            pdf.setDrawColor(80);
            pdf.setLineWidth(0.2);
            pdf.line(marginX, y, pageW - marginX, y);
          }
          y += 3;
        }

        if (q.type === "fill_blank") {
          y += 1;
        }

        if (q.type === "part_question" && q.parts?.length) {
          for (const p of q.parts) {
            const pm = typeof p.marks === "number" && p.marks > 0 ? ` [${p.marks} mark${p.marks === 1 ? "" : "s"}]` : "";
            writeWrapped(`(${p.label}) ${p.prompt}${pm}`, { size: 10, indent: 6 });
            for (let i = 0; i < 2; i++) {
              ensureSpace(7);
              y += 5;
              pdf.setDrawColor(80);
              pdf.setLineWidth(0.2);
              pdf.line(marginX + 6, y, pageW - marginX, y);
            }
            y += 2;
          }
        }

        if (q.diagram) {
          const img = await rasterizeDiagram(q.number);
          if (img) {
            ensureSpace(img.h + 6);
            y += 2;
            pdf.addImage(img.data, "JPEG", marginX + 6, y, img.w, img.h);
            y += img.h + 2;
          }
          if (q.diagram.instructions) {
            writeWrapped(q.diagram.instructions, { size: 9, style: "italic", indent: 6 });
          }
          for (let i = 0; i < 2; i++) {
            ensureSpace(7);
            y += 5;
            pdf.setDrawColor(80);
            pdf.setLineWidth(0.2);
            pdf.line(marginX, y, pageW - marginX, y);
          }
          y += 2;
        }

        y += 2;
      }

      // Footer with page numbers
      const total = pdf.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(110);
        pdf.text(
          `Shobs Academy | For internal use only | Generated: ${today}   |   Page ${i} of ${total}`,
          pageW / 2,
          pageH - 8,
          { align: "center" }
        );
        pdf.setTextColor(0);
      }

      const safeTitle = (worksheet.worksheet_title || "worksheet").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      pdf.save(`shobs-academy-${safeTitle}.pdf`);
      toast({ title: "Download started", description: "Your worksheet PDF has been saved." });
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? "Could not generate PDF.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const today = new Date().toLocaleDateString();

  return (
    <div className="space-y-6">
      <style>{`
        .worksheet-doc {
          background: white;
          color: #111;
          padding: 48px 56px;
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1.5;
        }
        .worksheet-doc h1, .worksheet-doc h2, .worksheet-doc h3, .worksheet-doc p { color: #111; }
      `}</style>

      <Card className="form-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-teacher" /> AI Worksheet Builder</CardTitle>
          <CardDescription>Generate a fully branded Shobs Academy worksheet, ready to print.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-900 dark:text-amber-200">
              <strong>*</strong> Please do not change tabs or close your system while the worksheet is being created. Generation can take up to 30 seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <Label>Grade / Year group</Label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Grade 5" />
            </div>
            <div className="md:col-span-2">
              <Label>Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fractions, Photosynthesis" />
            </div>
            <div>
              <Label>Number of questions</Label>
              <Input
                type="number"
                min={1}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIFFICULTY_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Question types</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {QUESTION_TYPES.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={types.includes(t.id)} onCheckedChange={() => toggleType(t.id)} />
                  {t.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Question Instructions</Label>
            <Textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Describe exactly what type of questions you need — e.g. include step-by-step workings, part marks like (a)(b)(c), diagrams for triangles, label the diagram, show construction lines..."
              rows={5}
            />
          </div>

          <div className="space-y-1">
            <Label>Paste source text (optional)</Label>
            <Textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} rows={4} placeholder="Lecture notes, textbook excerpt, etc." />
          </div>

          <div className="space-y-1">
            <Label>Upload source files</Label>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileSelect} className="hidden" />
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />Choose files
              </Button>
              <span className="text-sm text-muted-foreground">{files.length} file(s)</span>
            </div>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {f.name}
                    <button onClick={() => removeFile(i)}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="teacher" onClick={handleGenerate} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating your worksheet...</> : <><Sparkles className="h-4 w-4" /> Generate Worksheet</>}
            </Button>
            {worksheet && (
              <>
                <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </Button>
                <Button variant="outline" onClick={handleDownloadPDF} disabled={downloading || loading}>
                  {downloading ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing PDF...</> : <><Download className="h-4 w-4" /> Download PDF</>}
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground">AI-generated content — please review before distributing to students.</p>
        </CardContent>
      </Card>

      {worksheet && (
        <div ref={previewRef}>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div ref={docRef} className="worksheet-doc">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-6">
                  <img src={shobsLogo} alt="Shobs Academy" className="h-16 w-auto" />
                  <div className="text-2xl font-bold tracking-wide">SHOBS ACADEMY</div>
                </div>

                {/* Title */}
                <h1 className="text-center text-2xl font-bold mb-4">{worksheet.worksheet_title}</h1>

                {/* Student info */}
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm mb-4">
                  <span>Name: __________________________</span>
                  <span>Date: ________________</span>
                  <span>Grade: ____________</span>
                </div>

                {/* Instructions */}
                <div className="mb-6 italic text-sm">
                  <strong className="not-italic">Instructions: </strong>{worksheet.instructions}
                </div>

                {/* Questions */}
                <ol className="space-y-5 list-none p-0">
                  {worksheet.questions.map((q) => (
                    <li key={q.number} className="break-inside-avoid">
                      <div className="font-medium mb-1 flex justify-between gap-4">
                        <span>{q.number}. {q.prompt}</span>
                        {typeof q.marks === "number" && q.marks > 0 && (
                          <span className="text-xs whitespace-nowrap">[{q.marks} mark{q.marks === 1 ? "" : "s"}]</span>
                        )}
                      </div>
                      {q.type === "mcq" && q.options && (
                        <div className="ml-6 space-y-1 text-sm">
                          {q.options.map((opt, i) => <div key={i}>{opt}</div>)}
                        </div>
                      )}
                      {(q.type === "short_answer" || q.type === "numerical") && (
                        <div className="mt-2 space-y-4">
                          <div className="border-b border-black/60 h-5" />
                          <div className="border-b border-black/60 h-5" />
                          {q.type === "short_answer" && <div className="border-b border-black/60 h-5" />}
                        </div>
                      )}
                      {q.type === "true_false" && (
                        <div className="ml-6 text-sm mt-1">◯ True &nbsp;&nbsp; ◯ False</div>
                      )}
                      {q.type === "part_question" && q.parts && q.parts.length > 0 && (
                        <ol className="ml-6 mt-2 space-y-3 list-none p-0">
                          {q.parts.map((p, i) => (
                            <li key={i}>
                              <div className="text-sm flex justify-between gap-4">
                                <span>({p.label}) {p.prompt}</span>
                                {typeof p.marks === "number" && p.marks > 0 && (
                                  <span className="text-xs whitespace-nowrap">[{p.marks} mark{p.marks === 1 ? "" : "s"}]</span>
                                )}
                              </div>
                              <div className="mt-2 space-y-3">
                                <div className="border-b border-black/60 h-5" />
                                <div className="border-b border-black/60 h-5" />
                              </div>
                            </li>
                          ))}
                        </ol>
                      )}
                      {q.diagram && (
                        <div data-diagram-q={q.number} className="mt-3 border-2 border-dashed border-black/60 p-3">
                          <div className="text-xs font-semibold mb-2 uppercase tracking-wide">Figure</div>
                          <DiagramSVG diagram={q.diagram} />
                          {q.diagram.instructions && (
                            <div className="text-xs italic mt-2">{q.diagram.instructions}</div>
                          )}
                          <div className="mt-3 space-y-3">
                            <div className="border-b border-black/40 h-5" />
                            <div className="border-b border-black/40 h-5" />
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ol>

                {/* Footer */}
                <div className="mt-12 pt-3 border-t border-black text-center text-xs">
                  Shobs Academy | For internal use only | Generated: {today}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DiagramSVG({ diagram }: { diagram: NonNullable<Question["diagram"]> }) {
  const labels = diagram.labels ?? {};
  const dims = diagram.dimensions ?? {};
  const stroke = "#111";
  const common = { stroke, fill: "none", strokeWidth: 1.5 } as const;
  const textStyle: React.CSSProperties = { fontFamily: "Georgia, serif", fontSize: 12, fill: "#111" };

  const W = 320, H = 220;

  if (diagram.type === "right_angle_triangle") {
    const a = String(labels.a ?? dims.a ?? "a");
    const b = String(labels.b ?? dims.b ?? "b");
    const c = String(labels.c ?? dims.c ?? "c");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 360 }}>
        <polygon points="40,180 280,180 40,40" {...common} />
        <rect x="40" y="165" width="15" height="15" {...common} />
        <text x="160" y="200" textAnchor="middle" style={textStyle}>{b}</text>
        <text x="25" y="115" textAnchor="middle" style={textStyle}>{a}</text>
        <text x="170" y="100" textAnchor="middle" style={textStyle}>{c}</text>
      </svg>
    );
  }

  if (diagram.type === "triangle") {
    const A = String(labels.A ?? "A");
    const B = String(labels.B ?? "B");
    const C = String(labels.C ?? "C");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 360 }}>
        <polygon points="160,30 40,190 280,190" {...common} />
        <text x="160" y="22" textAnchor="middle" style={textStyle}>{A}</text>
        <text x="30" y="200" textAnchor="middle" style={textStyle}>{B}</text>
        <text x="290" y="200" textAnchor="middle" style={textStyle}>{C}</text>
      </svg>
    );
  }

  if (diagram.type === "circle") {
    const r = String(labels.radius ?? dims.radius ?? "r");
    const center = String(labels.center ?? "O");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 360 }}>
        <circle cx={W / 2} cy={H / 2} r={80} {...common} />
        <line x1={W / 2} y1={H / 2} x2={W / 2 + 80} y2={H / 2} {...common} />
        <circle cx={W / 2} cy={H / 2} r={2} fill={stroke} />
        <text x={W / 2 - 8} y={H / 2 - 6} style={textStyle}>{center}</text>
        <text x={W / 2 + 40} y={H / 2 - 6} textAnchor="middle" style={textStyle}>{r}</text>
      </svg>
    );
  }

  if (diagram.type === "graph_axes") {
    const xLabel = String(labels.x ?? "x");
    const yLabel = String(labels.y ?? "y");
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 360 }}>
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L6,4 L0,8" fill={stroke} />
          </marker>
        </defs>
        <line x1="20" y1={H - 30} x2={W - 20} y2={H - 30} {...common} markerEnd="url(#arr)" />
        <line x1="40" y1={H - 10} x2="40" y2="20" {...common} markerEnd="url(#arr)" />
        <text x={W - 30} y={H - 14} style={textStyle}>{xLabel}</text>
        <text x="48" y="22" style={textStyle}>{yLabel}</text>
        <text x="32" y={H - 18} style={textStyle}>O</text>
      </svg>
    );
  }

  if (diagram.type === "number_line") {
    const start = Number(dims.start ?? 0);
    const end = Number(dims.end ?? 10);
    const step = Number(dims.step ?? 1);
    const ticks: number[] = [];
    for (let v = start; v <= end + 1e-9; v += step) ticks.push(Number(v.toFixed(4)));
    const x = (v: number) => 30 + ((v - start) / (end - start || 1)) * (W - 60);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={120} style={{ maxWidth: 360 }}>
        <line x1="20" y1="60" x2={W - 20} y2="60" {...common} />
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={x(t)} y1="52" x2={x(t)} y2="68" {...common} />
            <text x={x(t)} y="86" textAnchor="middle" style={textStyle}>{t}</text>
          </g>
        ))}
      </svg>
    );
  }

  if (diagram.type === "bar_chart") {
    const entries = Object.entries(dims).filter(([, v]) => !isNaN(Number(v)));
    const max = Math.max(1, ...entries.map(([, v]) => Number(v)));
    const bw = entries.length ? (W - 60) / entries.length - 8 : 20;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 360 }}>
        <line x1="40" y1={H - 30} x2={W - 20} y2={H - 30} {...common} />
        <line x1="40" y1="20" x2="40" y2={H - 30} {...common} />
        {entries.map(([k, v], i) => {
          const h = (Number(v) / max) * (H - 70);
          const xPos = 50 + i * (bw + 8);
          return (
            <g key={k}>
              <rect x={xPos} y={H - 30 - h} width={bw} height={h} fill="#ddd" stroke={stroke} />
              <text x={xPos + bw / 2} y={H - 14} textAnchor="middle" style={textStyle}>{k}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (diagram.type === "pie_chart") {
    const entries = Object.entries(dims).filter(([, v]) => !isNaN(Number(v)));
    const total = entries.reduce((s, [, v]) => s + Number(v), 0) || 1;
    let acc = 0;
    const cx = W / 2, cy = H / 2, r = 80;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 360 }}>
        {entries.map(([k, v], i) => {
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += Number(v);
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = end - start > Math.PI ? 1 : 0;
          const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
          const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
          const mid = (start + end) / 2;
          const lx = cx + (r + 14) * Math.cos(mid), ly = cy + (r + 14) * Math.sin(mid);
          const shade = `hsl(0,0%,${90 - i * 10}%)`;
          return (
            <g key={k}>
              <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`} fill={shade} stroke={stroke} />
              <text x={lx} y={ly} textAnchor="middle" style={textStyle}>{k}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  // geometric_shape — best-fit polygon based on a "sides" dimension
  const sides = Math.max(3, Math.min(12, Number(dims.sides ?? 5)));
  const cx = W / 2, cy = H / 2, r = 80;
  const points = Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ maxWidth: 360 }}>
      <polygon points={points} {...common} />
      {Object.entries(labels).slice(0, sides).map(([k, v], i) => {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={k} x={cx + (r + 14) * Math.cos(a)} y={cy + (r + 14) * Math.sin(a)} textAnchor="middle" style={textStyle}>
            {String(v)}
          </text>
        );
      })}
    </svg>
  );
}