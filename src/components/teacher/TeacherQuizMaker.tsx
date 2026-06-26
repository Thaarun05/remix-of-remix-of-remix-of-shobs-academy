import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Sparkles, Upload, X, Plus, Trash2, Send, AlertTriangle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface AssignedStudent { user_id: string; student_name: string; }
interface Question {
  number: number;
  topic?: string;
  difficulty?: string;
  question: string;
  options: string[]; // length 4
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
}
interface Quiz {
  title: string;
  subject: string;
  grade: string;
  instructions: string;
  questions: Question[];
}

const PDFJS_VERSION = "6.0.227";

async function extractFromPdf(file: File): Promise<{ text: string; images: string[] }> {
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;
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

const blankQ = (n: number): Question => ({
  number: n,
  question: "",
  options: ["A) ", "B) ", "C) ", "D) "],
  correct_option: "A",
  explanation: "",
});

export function TeacherQuizMaker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topics, setTopics] = useState("");
  const [count, setCount] = useState("10");
  const [difficulty, setDifficulty] = useState("Medium");
  const [instructions, setInstructions] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);

  // Publish/assign settings
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [maxAttempts, setMaxAttempts] = useState<string>("");

  // Students
  const [students, setStudents] = useState<AssignedStudent[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // Results
  const [myQuizzes, setMyQuizzes] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => { loadStudents(); loadResults(); /* eslint-disable-next-line */ }, [user?.id]);

  const loadStudents = async () => {
    if (!user) return;
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
    setStudents(merged);
  };

  const loadResults = async () => {
    if (!user) return;
    setResultsLoading(true);
    try {
      const { data: quizzes } = await (supabase as any)
        .from("quizzes")
        .select("id, title, subject, grade, created_at, status")
        .eq("teacher_user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (!quizzes?.length) { setMyQuizzes([]); return; }
      const ids = quizzes.map((q: any) => q.id);
      const { data: assignments } = await (supabase as any)
        .from("quiz_assignments")
        .select("id, quiz_id, student_user_id, max_attempts, assigned_at")
        .in("quiz_id", ids)
        .is("deleted_at", null);
      const aIds = (assignments || []).map((a: any) => a.id);
      const { data: attempts } = aIds.length
        ? await (supabase as any)
            .from("quiz_attempts")
            .select("id, quiz_assignment_id, attempt_number, score, total, submitted_at")
            .in("quiz_assignment_id", aIds)
            .order("attempt_number", { ascending: true })
        : { data: [] };
      const studentIds: string[] = Array.from(new Set((assignments || []).map((a: any) => a.student_user_id as string)));
      const { data: profs } = studentIds.length
        ? await supabase.from("student_profiles").select("user_id, student_name").in("user_id", studentIds)
        : { data: [] };
      const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.student_name]));
      const merged = quizzes.map((q: any) => ({
        ...q,
        assignments: (assignments || []).filter((a: any) => a.quiz_id === q.id).map((a: any) => ({
          ...a,
          student_name: nameMap.get(a.student_user_id) || "Unknown",
          attempts: (attempts || []).filter((t: any) => t.quiz_assignment_id === a.id),
        })),
      }));
      setMyQuizzes(merged);
    } finally {
      setResultsLoading(false);
    }
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
    if (!subject || !grade || !topics) {
      toast({ title: "Missing fields", description: "Subject, grade and topics are required.", variant: "destructive" });
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
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { subject, grade, topics, count: parseInt(count) || 10, difficulty, text: combinedText, images, instructions },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const q = (data as any).quiz as Quiz;
      if (!q?.questions?.length) throw new Error("Generation failed — try again with clearer source material.");
      // Normalise
      q.title = q.title || `${subject} Quiz — ${topics.slice(0, 50)}`;
      q.subject = q.subject || subject;
      q.grade = q.grade || grade;
      q.instructions = q.instructions || "";
      q.questions = q.questions.map((qq, i) => ({
        number: qq.number || i + 1,
        topic: qq.topic || "",
        difficulty: qq.difficulty || "",
        question: qq.question || "",
        options: Array.isArray(qq.options) && qq.options.length === 4 ? qq.options : ["A) ", "B) ", "C) ", "D) "],
        correct_option: (["A","B","C","D"].includes(qq.correct_option) ? qq.correct_option : "A") as any,
        explanation: qq.explanation || "",
      }));
      setQuiz(q);
      setQuizId(null);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const updateQuiz = (mut: (q: Quiz) => void) => {
    setQuiz((prev) => {
      if (!prev) return prev;
      const next: Quiz = JSON.parse(JSON.stringify(prev));
      mut(next);
      return next;
    });
  };

  const addQuestion = () => updateQuiz((q) => { q.questions.push(blankQ(q.questions.length + 1)); });
  const removeQuestion = (i: number) => updateQuiz((q) => {
    q.questions.splice(i, 1);
    q.questions = q.questions.map((qq, idx) => ({ ...qq, number: idx + 1 }));
  });

  const handlePublish = async () => {
    if (!user || !quiz || publishing) return;
    // Validate
    for (const q of quiz.questions) {
      if (!q.question.trim()) { toast({ title: "Empty question", description: "Every question needs text.", variant: "destructive" }); return; }
      if (q.options.some((o) => !o.trim())) { toast({ title: "Empty option", description: `Question ${q.number} has an empty option.`, variant: "destructive" }); return; }
    }
    setPublishing(true);
    try {
      const { data: ins, error: insErr } = await (supabase as any).from("quizzes").insert({
        teacher_user_id: user.id,
        title: quiz.title,
        subject: quiz.subject || null,
        grade: quiz.grade || null,
        instructions: quiz.instructions || null,
        time_limit_minutes: timeLimit ? parseInt(timeLimit) : null,
        status: "published",
      }).select("id").single();
      if (insErr) throw insErr;
      const newId = ins.id as string;
      const rows = quiz.questions.map((q) => ({
        quiz_id: newId,
        number: q.number,
        topic: q.topic || null,
        difficulty: q.difficulty || null,
        question: q.question,
        options: q.options,
        correct_option: q.correct_option,
        explanation: q.explanation || null,
      }));
      const { error: qErr } = await (supabase as any).from("quiz_questions").insert(rows);
      if (qErr) throw qErr;
      setQuizId(newId);
      toast({ title: "Quiz published", description: "Now assign it to your students below." });
      loadResults();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const handleAssign = async () => {
    if (!user || !quizId || assigning) return;
    if (selectedStudents.size === 0) { toast({ title: "Pick students", description: "Select at least one student.", variant: "destructive" }); return; }
    setAssigning(true);
    try {
      const studentIds = Array.from(selectedStudents);
      const rows = studentIds.map((sid) => ({
        quiz_id: quizId,
        student_user_id: sid,
        teacher_user_id: user.id,
        max_attempts: maxAttempts ? parseInt(maxAttempts) : null,
        deleted_at: null,
      }));
      const { data: upserted, error: upErr } = await (supabase as any)
        .from("quiz_assignments")
        .upsert(rows, { onConflict: "quiz_id,student_user_id" })
        .select("id, student_user_id");
      if (upErr) throw upErr;
      // Notify
      const notifs = (upserted || []).map((a: any) => ({
        recipient_id: a.student_user_id,
        sender_id: user.id,
        type: "quiz_assigned",
        title: "📝 New Quiz Assigned",
        body: `Your teacher assigned the quiz "${quiz?.title}".`,
        role_target: "student",
        entity_table: "quiz_assignments",
        entity_id: a.id,
      }));
      if (notifs.length) await supabase.from("notifications").insert(notifs);
      toast({ title: "Assigned", description: `Quiz assigned to ${upserted?.length ?? 0} student(s).` });
      setSelectedStudents(new Set());
      loadResults();
    } catch (e: any) {
      toast({ title: "Assign failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setAssigning(false);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Generator */}
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-teacher" /> AI Quiz Maker</CardTitle>
          <CardDescription>Generate, edit, publish and assign interactive MCQ quizzes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>* Do not change tabs or close your system while the quiz is being generated.</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Subject *</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Mathematics" /></div>
            <div className="space-y-1"><Label>Grade *</Label><Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. Class 8" /></div>
            <div className="space-y-1">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Easy">Easy</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Hard">Hard</SelectItem>
                  <SelectItem value="Easy to Hard">Easy to Hard (progression)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Topics *</Label><Textarea value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="e.g. Linear equations, slope, intercept" rows={2} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Number of Questions</Label><Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} /></div>
            <div className="space-y-1"><Label>Instructions to students (optional)</Label><Input value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Choose the best answer." /></div>
          </div>
          <div className="space-y-1"><Label>Paste source text (optional)</Label><Textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} rows={4} placeholder="Lecture notes, textbook excerpt, etc." /></div>
          <div className="space-y-1">
            <Label>Upload PDF / PNG / JPG (optional)</Label>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileSelect} className="hidden" />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2" />Choose files</Button>
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">{f.name}<button onClick={() => removeFile(i)}><X className="h-3 w-3" /></button></Badge>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleGenerate} disabled={loading} className="dashboard-btn dashboard-btn-teacher">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating…</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Quiz</>}
          </Button>
        </CardContent>
      </Card>

      {/* Editor + Publish/Assign */}
      {quiz && (
        <Card className="dashboard-list-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Review & Edit</CardTitle>
            <CardDescription>Make any changes, then publish and assign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Quiz Title</Label><Input value={quiz.title} onChange={(e) => updateQuiz((q) => { q.title = e.target.value; })} /></div>
              <div className="space-y-1"><Label>Instructions</Label><Input value={quiz.instructions} onChange={(e) => updateQuiz((q) => { q.instructions = e.target.value; })} /></div>
            </div>

            <div className="space-y-4">
              {quiz.questions.map((q, i) => (
                <div key={i} className="rounded-md border p-3 space-y-2 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Q{q.number}</span>
                    <Button size="sm" variant="ghost" onClick={() => removeQuestion(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <Textarea value={q.question} onChange={(e) => updateQuiz((qq) => { qq.questions[i].question = e.target.value; })} rows={2} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => (
                      <Input key={oi} value={opt} onChange={(e) => updateQuiz((qq) => { qq.questions[i].options[oi] = e.target.value; })} />
                    ))}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Correct option</Label>
                      <Select value={q.correct_option} onValueChange={(v) => updateQuiz((qq) => { qq.questions[i].correct_option = v as any; })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["A","B","C","D"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Topic</Label><Input value={q.topic || ""} onChange={(e) => updateQuiz((qq) => { qq.questions[i].topic = e.target.value; })} /></div>
                  </div>
                  <div className="space-y-1"><Label>Explanation</Label><Textarea value={q.explanation} onChange={(e) => updateQuiz((qq) => { qq.questions[i].explanation = e.target.value; })} rows={2} /></div>
                </div>
              ))}
              <Button variant="outline" onClick={addQuestion}><Plus className="h-4 w-4 mr-2" />Add question</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t">
              <div className="space-y-1"><Label>Time limit (minutes, blank = none)</Label><Input type="number" min={1} value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} disabled={!!quizId} /></div>
              <div className="space-y-1"><Label>Max attempts (blank = unlimited)</Label><Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} /></div>
            </div>

            {!quizId ? (
              <Button onClick={handlePublish} disabled={publishing} className="dashboard-btn dashboard-btn-teacher">
                {publishing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Publishing…</> : <><Send className="h-4 w-4 mr-2" />Publish Quiz</>}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-success font-medium">✓ Published. Now assign to students.</div>
                <div>
                  <Label className="mb-2 block">Assign to students</Label>
                  {students.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No assigned students.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto rounded-md border p-2">
                      {students.map((s) => (
                        <label key={s.user_id} className="flex items-center gap-2 text-sm p-1 rounded hover:bg-muted cursor-pointer">
                          <Checkbox checked={selectedStudents.has(s.user_id)} onCheckedChange={() => toggleStudent(s.user_id)} />
                          <span>{s.student_name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAssign} disabled={assigning || selectedStudents.size === 0} className="dashboard-btn dashboard-btn-teacher">
                    {assigning ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Assigning…</> : <><Send className="h-4 w-4 mr-2" />Assign to {selectedStudents.size} student(s)</>}
                  </Button>
                  <Button variant="outline" onClick={() => { setQuiz(null); setQuizId(null); setSelectedStudents(new Set()); }}>
                    Start new quiz
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      <Card className="dashboard-list-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>My Quizzes & Results</CardTitle>
              <CardDescription>Attempts grouped by student.</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={loadResults} disabled={resultsLoading}>
              <RefreshCw className={`h-4 w-4 ${resultsLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {myQuizzes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quizzes published yet.</p>
          ) : (
            myQuizzes.map((q) => (
              <div key={q.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-semibold">{q.title}</div>
                    <div className="text-xs text-muted-foreground">{[q.subject, q.grade].filter(Boolean).join(" · ")} · {new Date(q.created_at).toLocaleDateString()}</div>
                  </div>
                  <Badge variant="outline">{q.assignments?.length || 0} assigned</Badge>
                </div>
                {q.assignments?.length > 0 && (
                  <div className="space-y-2">
                    {q.assignments.map((a: any) => {
                      const best = a.attempts?.length ? Math.max(...a.attempts.map((t: any) => t.score)) : null;
                      const total = a.attempts?.[0]?.total ?? null;
                      return (
                        <div key={a.id} className="text-sm border-l-2 pl-3 py-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{a.student_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {a.attempts.length} attempt(s){a.max_attempts ? ` / ${a.max_attempts}` : " / unlimited"}
                              {best != null && total != null ? ` · best ${best}/${total}` : ""}
                            </span>
                          </div>
                          {a.attempts.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {a.attempts.map((t: any) => `#${t.attempt_number}: ${t.score}/${t.total} (${new Date(t.submitted_at).toLocaleDateString()})`).join(" · ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
