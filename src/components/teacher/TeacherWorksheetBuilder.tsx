import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Download, RefreshCw, AlertTriangle, Upload, X, Pencil, Trash2, GripVertical, ArrowUp, ArrowDown, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractSourceFiles } from "@/lib/extractSource";
import shobsLogo from "@/assets/shobs-academy-logo.png";
import jsPDF from "jspdf";
import "svg2pdf.js";
import html2canvas from "html2canvas";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DiagramRenderer } from "./worksheet/diagrams/DiagramRenderer";
import { DiagramV2, DiagramKind, validateDiagramSpec } from "@/lib/diagrams/schemas";

interface Question {
  number: number;
  type: "mcq" | "short_answer" | "fill_blank" | "numerical" | "true_false" | "diagram" | "part_question";
  prompt: string;
  options?: string[];
  answer?: string;
  parts?: { label: string; prompt: string; marks?: number; answer?: string }[];
  diagram?: DiagramV2;
  marks?: number;
  difficulty?: "easy" | "medium" | "hard";
  blooms_level?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  rubric?: string;
  working?: string;
}

interface WorksheetMetadata {
  topic_tags: string[];
  estimated_minutes: number;
}

interface Worksheet {
  worksheet_title: string;
  instructions: string;
  metadata?: WorksheetMetadata;
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
  "Easy to Hard", "Hard to Easy", "Medium to Hard", "Medium to Easy",
  "Easy only", "Hard only", "Medium only",
];

const DIAGRAM_KINDS: DiagramKind[] = ["geometry_2d", "coordinate_graph", "number_line"];

// Resolve diagram specs (Pass B) for questions that have diagram description but no valid spec yet.
async function resolveDiagramSpecs(questions: Question[]): Promise<Question[]> {
  const jobs: Promise<void>[] = [];
  const result = questions.map((q) => ({ ...q }));
  const runJob = async (idx: number) => {
    const q = result[idx];
    if (!q.diagram) return;
    const kind = (q.diagram.kind && DIAGRAM_KINDS.includes(q.diagram.kind as DiagramKind))
      ? (q.diagram.kind as DiagramKind)
      : "geometry_2d";
    // If spec already validates, skip.
    if (q.diagram.spec) {
      const check = validateDiagramSpec(kind, q.diagram.spec);
      if (check.success) { q.diagram = { ...q.diagram, kind, spec: check.data, error: undefined }; return; }
    }
    const description = q.diagram.description ?? q.diagram.caption ?? "";
    let lastSpec: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error } = await supabase.functions.invoke("generate-diagram-spec", {
          body: { kind, description, question_prompt: q.prompt },
        });
        if (error) throw error;
        lastSpec = (data as any)?.spec;
        const check = validateDiagramSpec(kind, lastSpec);
        if (check.success) {
          q.diagram = { kind, spec: check.data, caption: q.diagram.caption ?? "", description };
          return;
        }
      } catch { /* retry */ }
    }
    q.diagram = { kind, spec: null, caption: q.diagram.caption ?? "", description, error: "spec_invalid" };
  };
  // Concurrency-capped parallelism
  const CONCURRENCY = 4;
  const indices = result.map((_, i) => i).filter((i) => result[i].diagram);
  let pointer = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, indices.length) }, async () => {
    while (pointer < indices.length) {
      const my = pointer++;
      await runJob(indices[my]);
    }
  });
  await Promise.all(workers);
  return result;
}

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
  const [downloading, setDownloading] = useState<null | "student" | "answer">(null);
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);
  const [sourceExcerpt, setSourceExcerpt] = useState<string>(""); // stored for regenerate
  const [regenIdx, setRegenIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const toggleType = (id: string) => {
    setTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const allowed = list.filter((f) => /\.(pdf|png|jpe?g)$/i.test(f.name));
    if (allowed.length !== list.length) {
      toast({ title: "Some files skipped", description: "Only PDF / PNG / JPG files supported.", variant: "destructive" });
    }
    setFiles((prev) => [...prev, ...allowed]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const renumber = (qs: Question[]) => qs.map((q, i) => ({ ...q, number: i + 1 }));

  const handleGenerate = async () => {
    if (!subject || !grade || !topic || types.length === 0) {
      toast({ title: "Missing fields", description: "Subject, grade, topic and at least one question type are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { text: extractedText, images } = files.length ? await extractSourceFiles(files) : { text: "", images: [] as string[] };
      const combinedText = [pastedText.trim(), extractedText.trim()].filter(Boolean).join("\n\n");
      setSourceExcerpt(combinedText);
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
      // Resolve diagram specs (Pass B) before showing preview.
      const resolved = await resolveDiagramSpecs(ws.questions);
      setWorksheet({ ...ws, questions: renumber(resolved) });
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message ?? "Try a more specific topic.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const regenerateQuestion = async (idx: number) => {
    if (!worksheet) return;
    setRegenIdx(idx);
    try {
      const target = worksheet.questions[idx];
      const others = worksheet.questions
        .filter((_, i) => i !== idx)
        .map((q) => ({ number: q.number, type: q.type, prompt: q.prompt }));
      const { data, error } = await supabase.functions.invoke("generate-worksheet", {
        body: {
          mode: "regenerate_question",
          worksheet_title: worksheet.worksheet_title,
          subject, grade, topic, difficulty,
          allowed_types: types.map((t) => QUESTION_TYPES.find((q) => q.id === t)?.label ?? t),
          other_questions_summary: others,
          target_number: target.number,
          target_type: target.type,
          instructions: objective,
          original_source_excerpt: sourceExcerpt,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const q = (data as any).question as Question;
      if (!q) throw new Error("No question returned");
      let replaced: Question = { ...q, number: target.number };
      if (replaced.diagram) {
        const [withSpec] = await resolveDiagramSpecs([replaced]);
        replaced = withSpec;
      }
      setWorksheet((prev) => prev ? { ...prev, questions: prev.questions.map((qq, i) => i === idx ? replaced : qq) } : prev);
      toast({ title: "Question regenerated" });
    } catch (e: any) {
      toast({ title: "Regeneration failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setRegenIdx(null);
    }
  };

  const deleteQuestion = (idx: number) => {
    setWorksheet((prev) => prev ? { ...prev, questions: renumber(prev.questions.filter((_, i) => i !== idx)) } : prev);
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setWorksheet((prev) => {
      if (!prev) return prev;
      const to = idx + dir;
      if (to < 0 || to >= prev.questions.length) return prev;
      return { ...prev, questions: renumber(arrayMove(prev.questions, idx, to)) };
    });
  };

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setWorksheet((prev) => prev ? { ...prev, questions: prev.questions.map((q, i) => i === idx ? { ...q, ...patch } : q) } : prev);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setWorksheet((prev) => {
      if (!prev) return prev;
      const oldIdx = prev.questions.findIndex((q) => String(q.number) === String(active.id));
      const newIdx = prev.questions.findIndex((q) => String(q.number) === String(over.id));
      if (oldIdx < 0 || newIdx < 0) return prev;
      return { ...prev, questions: renumber(arrayMove(prev.questions, oldIdx, newIdx)) };
    });
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

  const handleDownloadPDF = async (includeAnswers: boolean) => {
    if (!worksheet || downloading) return;
    setDownloading(includeAnswers ? "answer" : "student");
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
        if (y + h > pageH - marginBottom) { pdf.addPage(); y = marginTop; }
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

      // Header
      const logoData = await urlToDataUrl(shobsLogo);
      if (logoData) { try { pdf.addImage(logoData, "PNG", marginX, y, 18, 18); } catch { /* noop */ } }
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text("SHOBS ACADEMY", pageW - marginX, y + 11, { align: "right" });
      y += 22;
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.6);
      pdf.line(marginX, y, pageW - marginX, y);
      y += 6;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      const title = worksheet.worksheet_title || "Worksheet";
      const suffix = includeAnswers ? " — Answer Key" : "";
      const titleLines = pdf.splitTextToSize(title + suffix, contentW);
      for (const ln of titleLines) { ensureSpace(8); pdf.text(ln, pageW / 2, y, { align: "center" }); y += 7; }
      y += 2;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      const infoY = y;
      pdf.text("Name: __________________________", marginX, infoY);
      pdf.text("Date: ______________", marginX + 90, infoY);
      pdf.text("Grade: __________", marginX + 140, infoY);
      y += 8;

      if (worksheet.instructions) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        ensureSpace(5);
        pdf.text("Instructions:", marginX, y);
        y += 4.5;
        writeWrapped(worksheet.instructions, { size: 10, style: "italic" });
        y += 2;
      }

      const embedDiagram = async (num: number) => {
        const svg = docRef.current?.querySelector(`[data-diagram-q="${num}"] svg`) as SVGSVGElement | null;
        if (!svg) return;
        const maxW = Math.min(120, contentW);
        const vb = svg.viewBox?.baseVal;
        const ratio = vb && vb.width ? vb.height / vb.width : 0.66;
        const drawH = maxW * ratio;
        ensureSpace(drawH + 4);
        try {
          // svg2pdf plugs into jsPDF prototype
          await (pdf as any).svg(svg, { x: marginX + 6, y, width: maxW, height: drawH });
          y += drawH + 3;
          return;
        } catch {
          // fallback: rasterize with html2canvas
          const host = docRef.current?.querySelector(`[data-diagram-q="${num}"]`) as HTMLElement | null;
          if (!host) return;
          try {
            const canvas = await html2canvas(host, { scale: 2, backgroundColor: "#ffffff", logging: false });
            const data = canvas.toDataURL("image/jpeg", 0.85);
            const wMm = maxW;
            const hMm = wMm * (canvas.height / canvas.width);
            ensureSpace(hMm + 4);
            pdf.addImage(data, "JPEG", marginX + 6, y, wMm, hMm);
            y += hMm + 3;
          } catch { /* noop */ }
        }
      };

      for (const q of worksheet.questions) {
        y += 2;
        const marks = typeof q.marks === "number" && q.marks > 0 ? ` [${q.marks} mark${q.marks === 1 ? "" : "s"}]` : "";
        writeWrapped(`${q.number}. ${q.prompt}${marks}`, { size: 11, style: "bold" });

        if (q.type === "mcq" && q.options?.length) {
          for (const opt of q.options) writeWrapped(opt, { size: 10, indent: 8 });
        }
        if (q.type === "true_false") writeWrapped("◯ True     ◯ False", { size: 10, indent: 8 });
        if (!includeAnswers && (q.type === "short_answer" || q.type === "numerical")) {
          const lines = q.type === "short_answer" ? 3 : 2;
          for (let i = 0; i < lines; i++) {
            ensureSpace(8); y += 5;
            pdf.setDrawColor(80); pdf.setLineWidth(0.2);
            pdf.line(marginX, y, pageW - marginX, y);
          }
          y += 3;
        }
        if (q.type === "part_question" && q.parts?.length) {
          for (const p of q.parts) {
            const pm = typeof p.marks === "number" && p.marks > 0 ? ` [${p.marks} mark${p.marks === 1 ? "" : "s"}]` : "";
            writeWrapped(`(${p.label}) ${p.prompt}${pm}`, { size: 10, indent: 6 });
            if (!includeAnswers) {
              for (let i = 0; i < 2; i++) {
                ensureSpace(7); y += 5;
                pdf.setDrawColor(80); pdf.setLineWidth(0.2);
                pdf.line(marginX + 6, y, pageW - marginX, y);
              }
              y += 2;
            } else if (p.answer) {
              writeWrapped(`Answer: ${p.answer}`, { size: 10, indent: 10, style: "italic" });
            }
          }
        }
        if (q.diagram && q.diagram.spec) await embedDiagram(q.number);

        if (includeAnswers) {
          if (q.answer) {
            let ans = q.answer;
            if (q.type === "mcq" && q.options?.length) {
              // If answer is a letter, append full option
              const m = q.answer.trim().match(/^[A-D]$/i);
              if (m) {
                const letter = q.answer.trim().toUpperCase();
                const opt = q.options.find((o) => o.trim().toUpperCase().startsWith(`${letter})`));
                if (opt) ans = `${letter} — ${opt.replace(/^[A-D]\)\s*/i, "")}`;
              }
            }
            writeWrapped(`Answer: ${ans}`, { size: 10, style: "italic", indent: 4 });
          }
          if (q.working) writeWrapped(`Working: ${q.working}`, { size: 10, indent: 4 });
          if (q.rubric) writeWrapped(`Rubric: ${q.rubric}`, { size: 10, style: "italic", indent: 4 });
        }
        y += 2;
      }

      const total = pdf.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(110);
        pdf.text(
          `Shobs Academy | For internal use only | Generated: ${today}   |   Page ${i} of ${total}`,
          pageW / 2, pageH - 8, { align: "center" }
        );
        pdf.setTextColor(0);
      }

      const safeTitle = (worksheet.worksheet_title || "worksheet").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const filename = `shobs-academy-${safeTitle}${includeAnswers ? "-answer-key" : ""}.pdf`;
      pdf.save(filename);
      toast({ title: "Download started", description: `${includeAnswers ? "Answer key" : "Student"} PDF has been saved.` });
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? "Could not generate PDF.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const today = new Date().toLocaleDateString();
  const sortableIds = useMemo(() => (worksheet?.questions ?? []).map((q) => String(q.number)), [worksheet]);

  return (
    <div className="space-y-6">
      <style>{`
        .worksheet-doc { background: white; color: #111; padding: 48px 56px; font-family: Georgia, 'Times New Roman', serif; line-height: 1.5; }
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
              <strong>*</strong> Please do not change tabs or close your system while the worksheet is being created. Generation can take up to 45 seconds (includes diagram spec generation).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></div>
            <div><Label>Grade / Year group</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Grade 5" /></div>
            <div className="md:col-span-2"><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fractions, Photosynthesis" /></div>
            <div><Label>Number of questions</Label><Input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} placeholder="e.g. 10" /></div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DIFFICULTY_OPTIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
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
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)}
              placeholder="Describe exactly what type of questions you need — e.g. include step-by-step workings, part marks like (a)(b)(c), diagrams for triangles, label the diagram..."
              rows={5} />
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
                  <RefreshCw className="h-4 w-4" /> Regenerate All
                </Button>
                <Button variant="outline" onClick={() => handleDownloadPDF(false)} disabled={!!downloading || loading}>
                  {downloading === "student" ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing...</> : <><Download className="h-4 w-4" /> Download Student PDF</>}
                </Button>
                <Button variant="outline" onClick={() => handleDownloadPDF(true)} disabled={!!downloading || loading}>
                  {downloading === "answer" ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing...</> : <><Download className="h-4 w-4" /> Download Answer Key PDF</>}
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
                <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-6">
                  <img src={shobsLogo} alt="Shobs Academy" className="h-16 w-auto" />
                  <div className="text-2xl font-bold tracking-wide">SHOBS ACADEMY</div>
                </div>
                <h1 className="text-center text-2xl font-bold mb-4">{worksheet.worksheet_title}</h1>
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm mb-4">
                  <span>Name: __________________________</span>
                  <span>Date: ________________</span>
                  <span>Grade: ____________</span>
                </div>
                <div className="mb-6 italic text-sm">
                  <strong className="not-italic">Instructions: </strong>{worksheet.instructions}
                </div>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <ol className="space-y-5 list-none p-0">
                      {worksheet.questions.map((q, idx) => (
                        <SortableQuestion
                          key={q.number}
                          id={String(q.number)}
                          q={q}
                          idx={idx}
                          total={worksheet.questions.length}
                          editing={editingIdx === idx}
                          regenerating={regenIdx === idx}
                          onEditToggle={() => setEditingIdx((v) => v === idx ? null : idx)}
                          onSave={(patch) => { updateQuestion(idx, patch); setEditingIdx(null); }}
                          onDelete={() => deleteQuestion(idx)}
                          onRegenerate={() => regenerateQuestion(idx)}
                          onMoveUp={() => moveQuestion(idx, -1)}
                          onMoveDown={() => moveQuestion(idx, 1)}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>

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

function SortableQuestion({ id, q, idx, total, editing, regenerating, onEditToggle, onSave, onDelete, onRegenerate, onMoveUp, onMoveDown }: {
  id: string;
  q: Question;
  idx: number;
  total: number;
  editing: boolean;
  regenerating: boolean;
  onEditToggle: () => void;
  onSave: (patch: Partial<Question>) => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const [draftPrompt, setDraftPrompt] = useState(q.prompt);
  const [draftAnswer, setDraftAnswer] = useState(q.answer ?? "");
  const [draftOptions, setDraftOptions] = useState<string[]>(q.options ?? []);
  const [draftWorking, setDraftWorking] = useState(q.working ?? "");
  const [draftParts, setDraftParts] = useState(q.parts ?? []);

  // Re-sync drafts when opening edit mode
  const openEdit = () => {
    setDraftPrompt(q.prompt);
    setDraftAnswer(q.answer ?? "");
    setDraftOptions(q.options ?? []);
    setDraftWorking(q.working ?? "");
    setDraftParts(q.parts ?? []);
    onEditToggle();
  };

  return (
    <li ref={setNodeRef} style={style} className="break-inside-avoid group border border-transparent hover:border-black/10 rounded p-2 -mx-2">
      <div className="flex items-start gap-2">
        <button
          className="mt-1 p-1 rounded hover:bg-black/5 cursor-grab text-black/50 print:hidden"
          {...attributes} {...listeners}
          aria-label={`Drag question ${q.number}`}
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          {!editing && (
            <div className="font-medium mb-1 flex justify-between gap-4">
              <span>{q.number}. {q.prompt}</span>
              {typeof q.marks === "number" && q.marks > 0 && (
                <span className="text-xs whitespace-nowrap">[{q.marks} mark{q.marks === 1 ? "" : "s"}]</span>
              )}
            </div>
          )}

          {!editing && q.type === "mcq" && q.options && (
            <div className="ml-6 space-y-1 text-sm">
              {q.options.map((opt, i) => <div key={i}>{opt}</div>)}
            </div>
          )}
          {!editing && (q.type === "short_answer" || q.type === "numerical") && (
            <div className="mt-2 space-y-4">
              <div className="border-b border-black/60 h-5" />
              <div className="border-b border-black/60 h-5" />
              {q.type === "short_answer" && <div className="border-b border-black/60 h-5" />}
            </div>
          )}
          {!editing && q.type === "true_false" && (
            <div className="ml-6 text-sm mt-1">◯ True &nbsp;&nbsp; ◯ False</div>
          )}
          {!editing && q.type === "part_question" && q.parts && q.parts.length > 0 && (
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
          {!editing && q.diagram && (
            <div data-diagram-q={q.number} className="mt-3 border-2 border-dashed border-black/60 p-3">
              <div className="text-xs font-semibold mb-2 uppercase tracking-wide">Figure</div>
              <DiagramRenderer diagram={q.diagram} />
              {q.diagram.caption && (
                <div className="text-xs italic mt-2">{q.diagram.caption}</div>
              )}
              <div className="mt-3 space-y-3">
                <div className="border-b border-black/40 h-5" />
                <div className="border-b border-black/40 h-5" />
              </div>
            </div>
          )}

          {editing && (
            <div className="space-y-2 bg-black/[0.02] rounded p-2 border border-black/10">
              <div>
                <Label className="text-xs">Prompt</Label>
                <Textarea rows={3} value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} />
              </div>
              {q.type === "mcq" && (
                <div>
                  <Label className="text-xs">Options</Label>
                  {draftOptions.map((opt, i) => (
                    <Input key={i} value={opt} onChange={(e) => setDraftOptions((prev) => prev.map((o, j) => j === i ? e.target.value : o))} className="mt-1" />
                  ))}
                </div>
              )}
              {q.type === "part_question" && draftParts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs">Parts</Label>
                  {draftParts.map((p, i) => (
                    <div key={i} className="grid grid-cols-[auto_1fr] gap-2 items-start">
                      <span className="mt-2 text-sm">({p.label})</span>
                      <div className="space-y-1">
                        <Textarea rows={2} value={p.prompt} onChange={(e) => setDraftParts((prev) => prev.map((pp, j) => j === i ? { ...pp, prompt: e.target.value } : pp))} />
                        <Input placeholder="Answer" value={p.answer ?? ""} onChange={(e) => setDraftParts((prev) => prev.map((pp, j) => j === i ? { ...pp, answer: e.target.value } : pp))} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <Label className="text-xs">Answer</Label>
                <Textarea rows={2} value={draftAnswer} onChange={(e) => setDraftAnswer(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Working</Label>
                <Textarea rows={2} value={draftWorking} onChange={(e) => setDraftWorking(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={onEditToggle}>Cancel</Button>
                <Button size="sm" variant="teacher" onClick={() => onSave({
                  prompt: draftPrompt,
                  answer: draftAnswer,
                  working: draftWorking,
                  options: q.type === "mcq" ? draftOptions : q.options,
                  parts: q.type === "part_question" ? draftParts : q.parts,
                })}><Save className="h-3 w-3" /> Save</Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 opacity-70 group-hover:opacity-100 print:hidden">
          <Button size="icon" variant="ghost" onClick={onMoveUp} disabled={idx === 0} title="Move up"><ArrowUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={onMoveDown} disabled={idx === total - 1} title="Move down"><ArrowDown className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={editing ? onEditToggle : openEdit} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" onClick={onRegenerate} disabled={regenerating} title="Regenerate">
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </li>
  );
}