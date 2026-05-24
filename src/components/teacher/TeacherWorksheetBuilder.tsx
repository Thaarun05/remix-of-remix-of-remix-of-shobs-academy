import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Download, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
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

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("Easy to Hard");
  const [types, setTypes] = useState<string[]>(["mcq", "short_answer"]);
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [worksheet, setWorksheet] = useState<Worksheet | null>(null);

  const toggleType = (id: string) => {
    setTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleGenerate = async () => {
    if (!subject || !grade || !topic || types.length === 0) {
      toast({ title: "Missing fields", description: "Subject, grade, topic and at least one question type are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-worksheet", {
        body: {
          subject, grade, topic,
          count: Number(count),
          difficulty,
          types: types.map((t) => QUESTION_TYPES.find((q) => q.id === t)?.label ?? t),
          objective,
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

  const handleDownloadPDF = async () => {
    if (!docRef.current || downloading) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(docRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const safeTitle = (worksheet?.worksheet_title || "worksheet").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
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
                  {timeAllowed && <span>Time: {timeAllowed}</span>}
                  {totalMarks && <span>Total Marks: {totalMarks}</span>}
                </div>

                {/* Instructions */}
                <div className="mb-6 italic text-sm">
                  <strong className="not-italic">Instructions: </strong>{worksheet.instructions}
                </div>

                {/* Questions */}
                <ol className="space-y-5 list-none p-0">
                  {worksheet.questions.map((q) => (
                    <li key={q.number} className="break-inside-avoid">
                      <div className="font-medium mb-1">{q.number}. {q.prompt}</div>
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