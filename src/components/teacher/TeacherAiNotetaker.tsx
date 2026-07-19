import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, NotebookPen, Download, RefreshCw, AlertTriangle, Upload, X, FolderPlus, Send, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import shobsLogo from "@/assets/shobs-academy-logo.png";
import jsPDF from "jspdf";

// Convert imported PNG asset to a data URL so jsPDF can embed it.
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface KeyTerm { term: string; definition: string; }
interface Section {
  heading: string;
  bullets: string[];
  key_terms: KeyTerm[];
  formulas: string[];
}
interface Notes {
  title: string;
  subject: string;
  grade: string;
  summary: string;
  sections: Section[];
  quick_revision: string[];
}

interface AssignedStudent { user_id: string; student_name: string; }

async function extractFromPdf(file: File): Promise<{ text: string; images: string[] }> {
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let combined = "";
  const images: string[] = [];
  const maxPages = Math.min(doc.numPages, 30);
  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pageText = tc.items.map((it: any) => it.str).join(" ").trim();
    if (pageText.length > 40) {
      combined += `\n\n--- Page ${i} ---\n${pageText}`;
    } else {
      // Likely scanned — rasterise the page so the model can read it
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      images.push(canvas.toDataURL("image/png"));
    }
  }
  return { text: combined.trim(), images };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function TeacherAiNotetaker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const docRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [instructions, setInstructions] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savingResource, setSavingResource] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [notes, setNotes] = useState<Notes | null>(null);

  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState("");

  const loadAssignedStudents = async () => {
    if (!user || studentsLoaded) return;
    const { data: primary } = await supabase
      .from("student_profiles")
      .select("user_id, student_name")
      .eq("assigned_teacher_id", user.id);
    const { data: links } = await supabase
      .from("student_teacher_assignments")
      .select("student_user_id")
      .eq("teacher_user_id", user.id);
    const extraIds = (links || [])
      .map((l: any) => l.student_user_id)
      .filter((id: string) => !(primary || []).some((p: any) => p.user_id === id));
    let extra: AssignedStudent[] = [];
    if (extraIds.length) {
      const { data } = await supabase
        .from("student_profiles")
        .select("user_id, student_name")
        .in("user_id", extraIds);
      extra = data || [];
    }
    const merged = [...(primary || []), ...extra].sort((a, b) => a.student_name.localeCompare(b.student_name));
    setAssignedStudents(merged);
    setStudentsLoaded(true);
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
    if (!subject || !grade || !topic) {
      toast({ title: "Missing fields", description: "Subject, grade and topic are required.", variant: "destructive" });
      return;
    }
    if (!pastedText.trim() && files.length === 0) {
      toast({ title: "No source material", description: "Paste lecture text or upload at least one file.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let extractedText = "";
      const images: string[] = [];
      for (const f of files) {
        if (/\.pdf$/i.test(f.name)) {
          const r = await extractFromPdf(f);
          extractedText += `\n\n[From ${f.name}]\n${r.text}`;
          images.push(...r.images);
        } else {
          images.push(await fileToDataUrl(f));
        }
      }
      const combinedText = [pastedText.trim(), extractedText.trim()].filter(Boolean).join("\n\n");
      const { data, error } = await supabase.functions.invoke("generate-notes", {
        body: { subject, grade, topic, text: combinedText, images, instructions },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const n = (data as any).notes as Notes;
      if (!n?.sections?.length) throw new Error("Generation failed — try clearer source material.");
      // Normalise
      n.title = n.title || topic;
      n.subject = n.subject || subject;
      n.grade = n.grade || grade;
      n.summary = n.summary || "";
      n.quick_revision = n.quick_revision || [];
      n.sections = n.sections.map((s) => ({
        heading: s.heading || "",
        bullets: s.bullets || [],
        key_terms: s.key_terms || [],
        formulas: s.formulas || [],
      }));
      setNotes(n);
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ----- Edit helpers -----
  const updateNotes = (mut: (n: Notes) => void) => {
    setNotes((prev) => {
      if (!prev) return prev;
      const next: Notes = JSON.parse(JSON.stringify(prev));
      mut(next);
      return next;
    });
  };

  // ----- PDF helpers -----
  const buildPdf = async (): Promise<{ pdf: jsPDF; safeTitle: string }> => {
    if (!notes) throw new Error("Notes not ready");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;
    const marginX = 18;
    const marginTop = 20;
    const marginBottom = 18;
    const contentW = pageW - marginX * 2;
    let y = marginTop;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - marginBottom) {
        pdf.addPage();
        y = marginTop;
      }
    };

    const writeWrapped = (
      text: string,
      opts: { size?: number; style?: "normal" | "bold" | "italic"; font?: "helvetica" | "courier" | "times"; indent?: number; lineGap?: number; color?: [number, number, number] } = {}
    ) => {
      const { size = 11, style = "normal", font = "helvetica", indent = 0, lineGap = 1.4, color = [17, 17, 17] } = opts;
      pdf.setFont(font, style);
      pdf.setFontSize(size);
      pdf.setTextColor(color[0], color[1], color[2]);
      const lh = size * 0.4 * lineGap; // mm per line
      const lines = pdf.splitTextToSize(text, contentW - indent);
      for (const line of lines) {
        ensureSpace(lh);
        pdf.text(line, marginX + indent, y);
        y += lh;
      }
    };

    // ----- Header -----
    const logoData = await urlToDataUrl(shobsLogo);
    if (logoData) {
      try { pdf.addImage(logoData, "PNG", marginX, y - 4, 18, 18); } catch { /* ignore */ }
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(17, 17, 17);
    pdf.text("SHOBS ACADEMY", pageW - marginX, y + 8, { align: "right" });
    y += 18;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.6);
    pdf.line(marginX, y, pageW - marginX, y);
    y += 8;

    // ----- Title -----
    pdf.setFont("times", "bold");
    pdf.setFontSize(20);
    const titleLines = pdf.splitTextToSize(notes.title || "Study Notes", contentW);
    for (const tl of titleLines) {
      ensureSpace(9);
      pdf.text(tl, pageW / 2, y, { align: "center" });
      y += 8;
    }
    y += 1;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const subtitle = [notes.subject, notes.grade].filter(Boolean).join(" · ");
    if (subtitle) {
      ensureSpace(6);
      pdf.text(subtitle, pageW / 2, y, { align: "center" });
      y += 8;
    } else {
      y += 4;
    }

    const sectionHeading = (text: string) => {
      ensureSpace(14);
      y += 2;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(17, 17, 17);
      pdf.text(text.toUpperCase(), marginX, y);
      y += 2;
      pdf.setDrawColor(120, 120, 120);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, y, pageW - marginX, y);
      y += 5;
    };

    const subHeading = (text: string) => {
      ensureSpace(7);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(text.toUpperCase(), marginX, y);
      y += 5;
    };

    // ----- Summary -----
    if (notes.summary) {
      sectionHeading("Summary");
      writeWrapped(notes.summary, { size: 11, style: "italic", font: "times" });
      y += 2;
    }

    // ----- Sections -----
    notes.sections.forEach((s, i) => {
      sectionHeading(`${i + 1}. ${s.heading || "Section"}`);

      if (s.bullets.length > 0) {
        for (const b of s.bullets) {
          if (!b.trim()) continue;
          // Bullet marker
          ensureSpace(5);
          const startY = y;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          pdf.setTextColor(17, 17, 17);
          pdf.text("•", marginX + 2, startY);
          writeWrapped(b.trim(), { size: 11, indent: 6 });
          y += 0.5;
          // restore y already moved by writeWrapped; nothing extra needed beyond small gap
          // (we don't reset y to startY because writeWrapped already advanced past the bullet)
        }
        y += 1;
      }

      if (s.key_terms.length > 0) {
        subHeading("Key terms");
        for (const kt of s.key_terms) {
          if (!kt.term && !kt.definition) continue;
          const combined = `${kt.term}: ${kt.definition}`;
          // bold term + normal definition: render in one wrapped paragraph
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          const lines = pdf.splitTextToSize(combined, contentW - 2);
          const lh = 11 * 0.4 * 1.4;
          lines.forEach((line: string, idx: number) => {
            ensureSpace(lh);
            if (idx === 0 && kt.term) {
              // draw bold term portion, then normal rest
              const termText = `${kt.term}:`;
              pdf.setFont("helvetica", "bold");
              pdf.text(termText, marginX + 2, y);
              const termWidth = pdf.getTextWidth(termText + " ");
              const rest = line.slice(termText.length).replace(/^\s+/, "");
              pdf.setFont("helvetica", "normal");
              pdf.text(rest, marginX + 2 + termWidth, y);
            } else {
              pdf.setFont("helvetica", "normal");
              pdf.text(line, marginX + 2, y);
            }
            y += lh;
          });
        }
        y += 1;
      }

      if (s.formulas.length > 0) {
        subHeading("Formulas");
        for (const f of s.formulas) {
          if (!f.trim()) continue;
          writeWrapped(f, { size: 10, font: "courier", indent: 2 });
        }
        y += 1;
      }

      y += 2;
    });

    // ----- Quick revision -----
    if (notes.quick_revision.length > 0) {
      sectionHeading("Quick revision");
      notes.quick_revision.forEach((q, idx) => {
        if (!q.trim()) return;
        const num = `${idx + 1}.`;
        ensureSpace(5);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(17, 17, 17);
        pdf.text(num, marginX + 2, y);
        writeWrapped(q.trim(), { size: 11, indent: 9 });
      });
    }

    // ----- Footer on every page -----
    const totalPages = pdf.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      pdf.setPage(p);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      pdf.line(marginX, pageH - marginBottom + 6, pageW - marginX, pageH - marginBottom + 6);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      pdf.text(
        `Shobs Academy  |  For internal use only  |  Generated: ${today}  |  Page ${p} of ${totalPages}`,
        pageW / 2,
        pageH - marginBottom + 11,
        { align: "center" }
      );
    }

    const safeTitle = (notes.title || "notes").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    return { pdf, safeTitle };
  };

  const handleDownloadPDF = async () => {
    if (!notes || downloading) return;
    setDownloading(true);
    try {
      const { pdf, safeTitle } = await buildPdf();
      pdf.save(`shobs-academy-notes-${safeTitle}.pdf`);
      toast({ title: "Download started", description: "Your notes PDF has been saved." });
    } catch (e: any) {
      toast({ title: "Download failed", description: e?.message ?? "Could not generate PDF.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToResources = async () => {
    if (!user || !notes || savingResource) return;
    setSavingResource(true);
    try {
      const { pdf, safeTitle } = await buildPdf();
      const blob: Blob = pdf.output("blob");
      const timestamp = Date.now();
      const fileName = `${safeTitle}.pdf`;
      const storagePath = `${user.id}/${timestamp}_${fileName}`;
      const { error: upErr } = await supabase.storage.from("teacher-resources").upload(storagePath, blob, { contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { error: insErr } = await (supabase as any).from("teacher_resources").insert({
        title: notes.title,
        description: notes.summary || null,
        subject: notes.subject || null,
        file_name: fileName,
        file_type: "application/pdf",
        file_size: blob.size,
        storage_path: storagePath,
        uploaded_by: user.id,
      });
      if (insErr) throw insErr;
      toast({ title: "Saved to Resources", description: "Your notes are now in the Resources library." });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message ?? "Could not save to Resources.", variant: "destructive" });
    } finally {
      setSavingResource(false);
    }
  };

  const handleAssignToStudent = async () => {
    if (!user || !notes || assigning) return;
    if (!assignStudentId) {
      toast({ title: "Pick a student", description: "Select a student to assign these notes to.", variant: "destructive" });
      return;
    }
    setAssigning(true);
    try {
      const { pdf, safeTitle } = await buildPdf();
      const blob: Blob = pdf.output("blob");
      const timestamp = Date.now();
      const fileName = `${safeTitle}.pdf`;
      const storagePath = `${user.id}/${timestamp}_${fileName}`;
      const { error: upErr } = await supabase.storage.from("note-files").upload(storagePath, blob, { contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("notes").insert({
        teacher_user_id: user.id,
        student_user_id: assignStudentId,
        title: notes.title,
        subject: notes.subject || null,
        grade: notes.grade || null,
        file_name: fileName,
        file_type: "application/pdf",
        storage_path: storagePath,
        file_size: blob.size,
      });
      if (insErr) throw insErr;
      await supabase.from("notifications").insert({
        recipient_id: assignStudentId,
        sender_id: user.id,
        type: "note_uploaded",
        title: "📚 New Note Uploaded",
        body: `Your teacher uploaded "${notes.title}"${notes.subject ? ` for ${notes.subject}` : ""}.`,
        role_target: "student",
        entity_table: "notes",
      });
      toast({ title: "Assigned to student", description: "The student will see this note in their Notes tab." });
      setAssignStudentId("");
    } catch (e: any) {
      toast({ title: "Assign failed", description: e?.message ?? "Could not assign note.", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const today = new Date().toLocaleDateString();

  return (
    <div className="space-y-6">
      <style>{`
        .notes-doc {
          background: white;
          color: #111;
          padding: 48px 56px;
          font-family: Georgia, 'Times New Roman', serif;
          line-height: 1.5;
        }
        .notes-doc h1, .notes-doc h2, .notes-doc h3, .notes-doc p { color: #111; }
      `}</style>

      <Card className="form-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><NotebookPen className="h-5 w-5 text-teacher" /> AI Notetaker</CardTitle>
          <CardDescription>Turn lecture material into branded Shobs Academy study notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-900 dark:text-amber-200">
              <strong>*</strong> Please do not change tabs or close your system while notes are being created. Generation can take up to 30 seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Biology" />
            </div>
            <div>
              <Label>Grade / Year group</Label>
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Grade 9" />
            </div>
            <div>
              <Label>Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" />
            </div>
          </div>

          <div>
            <Label>Instructions (optional)</Label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Tone, depth, focus areas, anything to emphasise or skip..."
              rows={3}
            />
          </div>

          <div>
            <Label>Paste lecture text (optional)</Label>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste lecture transcript, textbook excerpts, your typed notes..."
              rows={6}
            />
          </div>

          <div>
            <Label>Upload source files</Label>
            <div className="flex items-center gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Choose files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
              />
              <span className="text-xs text-muted-foreground">{files.length} file(s)</span>
            </div>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="teacher" onClick={handleGenerate} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating your notes...</> : <><NotebookPen className="h-4 w-4" /> Generate Notes</>}
            </Button>
            {notes && (
              <Button variant="outline" onClick={handleGenerate} disabled={loading}>
                <RefreshCw className="h-4 w-4" /> Regenerate
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">AI-generated content — please review and edit before sharing with students.</p>
        </CardContent>
      </Card>

      {notes && (
        <div ref={previewRef} className="space-y-6">
          {/* Editor */}
          <Card>
            <CardHeader>
              <CardTitle>Edit notes</CardTitle>
              <CardDescription>Tweak anything before exporting or sharing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <Label>Title</Label>
                  <Input value={notes.title} onChange={(e) => updateNotes((n) => { n.title = e.target.value; })} />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Input value={notes.subject} onChange={(e) => updateNotes((n) => { n.subject = e.target.value; })} />
                </div>
                <div>
                  <Label>Grade</Label>
                  <Input value={notes.grade} onChange={(e) => updateNotes((n) => { n.grade = e.target.value; })} />
                </div>
              </div>

              <div>
                <Label>Summary</Label>
                <Textarea rows={3} value={notes.summary} onChange={(e) => updateNotes((n) => { n.summary = e.target.value; })} />
              </div>

              {notes.sections.map((section, si) => (
                <div key={si} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      className="font-semibold"
                      value={section.heading}
                      onChange={(e) => updateNotes((n) => { n.sections[si].heading = e.target.value; })}
                    />
                    <Button variant="ghost" size="icon" onClick={() => updateNotes((n) => { n.sections.splice(si, 1); })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide">Bullets</Label>
                    {section.bullets.map((b, bi) => (
                      <div key={bi} className="flex items-start gap-2">
                        <Textarea rows={2} value={b} onChange={(e) => updateNotes((n) => { n.sections[si].bullets[bi] = e.target.value; })} />
                        <Button variant="ghost" size="icon" onClick={() => updateNotes((n) => { n.sections[si].bullets.splice(bi, 1); })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateNotes((n) => { n.sections[si].bullets.push(""); })}>
                      <Plus className="h-3 w-3 mr-1" /> Add bullet
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide">Key terms</Label>
                    {section.key_terms.map((kt, ki) => (
                      <div key={ki} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-2">
                        <Input placeholder="Term" value={kt.term} onChange={(e) => updateNotes((n) => { n.sections[si].key_terms[ki].term = e.target.value; })} />
                        <Input placeholder="Definition" value={kt.definition} onChange={(e) => updateNotes((n) => { n.sections[si].key_terms[ki].definition = e.target.value; })} />
                        <Button variant="ghost" size="icon" onClick={() => updateNotes((n) => { n.sections[si].key_terms.splice(ki, 1); })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateNotes((n) => { n.sections[si].key_terms.push({ term: "", definition: "" }); })}>
                      <Plus className="h-3 w-3 mr-1" /> Add term
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide">Formulas</Label>
                    {section.formulas.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-2">
                        <Input value={f} onChange={(e) => updateNotes((n) => { n.sections[si].formulas[fi] = e.target.value; })} />
                        <Button variant="ghost" size="icon" onClick={() => updateNotes((n) => { n.sections[si].formulas.splice(fi, 1); })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => updateNotes((n) => { n.sections[si].formulas.push(""); })}>
                      <Plus className="h-3 w-3 mr-1" /> Add formula
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => updateNotes((n) => { n.sections.push({ heading: "New section", bullets: [], key_terms: [], formulas: [] }); })}>
                <Plus className="h-4 w-4 mr-1" /> Add section
              </Button>

              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wide">Quick revision</Label>
                {notes.quick_revision.map((q, qi) => (
                  <div key={qi} className="flex items-center gap-2">
                    <Input value={q} onChange={(e) => updateNotes((n) => { n.quick_revision[qi] = e.target.value; })} />
                    <Button variant="ghost" size="icon" onClick={() => updateNotes((n) => { n.quick_revision.splice(qi, 1); })}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateNotes((n) => { n.quick_revision.push(""); })}>
                  <Plus className="h-3 w-3 mr-1" /> Add point
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Export &amp; share</CardTitle>
              <CardDescription>Download, save to your Resources library, or assign directly to a student.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleDownloadPDF} disabled={downloading}>
                  {downloading ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing PDF...</> : <><Download className="h-4 w-4" /> Download PDF</>}
                </Button>
                <Button variant="outline" onClick={handleSaveToResources} disabled={savingResource}>
                  {savingResource ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><FolderPlus className="h-4 w-4" /> Save to Resources</>}
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
                <div className="flex-1 min-w-[220px]">
                  <Label>Assign to student</Label>
                  <Select
                    value={assignStudentId}
                    onValueChange={(v) => setAssignStudentId(v)}
                    onOpenChange={(o) => { if (o) loadAssignedStudents(); }}
                  >
                    <SelectTrigger><SelectValue placeholder={studentsLoaded ? "Select a student" : "Loading students..."} /></SelectTrigger>
                    <SelectContent>
                      {assignedStudents.map((s) => (
                        <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="teacher" onClick={handleAssignToStudent} disabled={assigning || !assignStudentId}>
                  {assigning ? <><Loader2 className="h-4 w-4 animate-spin" /> Assigning...</> : <><Send className="h-4 w-4" /> Assign</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Branded preview */}
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>This is what the PDF will look like.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div ref={docRef} className="notes-doc">
                <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-6">
                  <img src={shobsLogo} alt="Shobs Academy" className="h-16 w-auto" />
                  <div className="text-2xl font-bold tracking-wide">SHOBS ACADEMY</div>
                </div>

                <h1 className="text-center text-2xl font-bold mb-2">{notes.title}</h1>
                <div className="text-center text-sm mb-6">
                  {notes.subject}{notes.grade ? ` · ${notes.grade}` : ""}
                </div>

                {notes.summary && (
                  <div className="mb-6">
                    <h2 className="text-base font-bold uppercase tracking-wide border-b border-black/40 pb-1 mb-2">Summary</h2>
                    <p className="text-sm italic">{notes.summary}</p>
                  </div>
                )}

                {notes.sections.map((s, i) => (
                  <div key={i} className="mb-6 break-inside-avoid">
                    <h2 className="text-base font-bold uppercase tracking-wide border-b border-black/40 pb-1 mb-2">
                      {i + 1}. {s.heading}
                    </h2>
                    {s.bullets.length > 0 && (
                      <ul className="list-disc ml-6 space-y-1 text-sm">
                        {s.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                      </ul>
                    )}
                    {s.key_terms.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide mb-1">Key terms</div>
                        <dl className="text-sm space-y-1">
                          {s.key_terms.map((k, ki) => (
                            <div key={ki}>
                              <dt className="inline font-semibold">{k.term}:</dt>{" "}
                              <dd className="inline">{k.definition}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}
                    {s.formulas.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold uppercase tracking-wide mb-1">Formulas</div>
                        <ul className="text-sm font-mono space-y-1">
                          {s.formulas.map((f, fi) => <li key={fi}>{f}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {notes.quick_revision.length > 0 && (
                  <div className="mt-8 mb-2 break-inside-avoid">
                    <h2 className="text-base font-bold uppercase tracking-wide border-b border-black/40 pb-1 mb-2">Quick revision</h2>
                    <ol className="list-decimal ml-6 space-y-1 text-sm">
                      {notes.quick_revision.map((q, qi) => <li key={qi}>{q}</li>)}
                    </ol>
                  </div>
                )}

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