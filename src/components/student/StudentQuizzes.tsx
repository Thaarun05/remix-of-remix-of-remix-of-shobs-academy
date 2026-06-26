import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, ListChecks, Play, Eye, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AssignmentRow {
  id: string;
  quiz_id: string;
  max_attempts: number | null;
  assigned_at: string;
  quizzes: { title: string; subject: string | null; grade: string | null; time_limit_minutes: number | null } | null;
  quiz_attempts: { id: string; attempt_number: number; score: number; total: number; submitted_at: string; results: any }[];
}

interface TakingQuiz {
  assignment: AssignmentRow;
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  instructions: string | null;
  time_limit_minutes: number | null;
  questions: { id: string; number: number; topic: string | null; question: string; options: string[] }[];
}

export function StudentQuizzes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignmentRow[]>([]);

  const [taking, setTaking] = useState<TakingQuiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; results: any[]; attempt_number: number } | null>(null);
  const [reviewing, setReviewing] = useState<{ title: string; attempt: any } | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("quiz_assignments")
        .select("id, quiz_id, max_attempts, assigned_at, quizzes(title, subject, grade, time_limit_minutes), quiz_attempts(id, attempt_number, score, total, submitted_at, results)")
        .eq("student_user_id", user.id)
        .is("deleted_at", null)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      setRows(((data as any) || []) as AssignmentRow[]);
    } catch (e: any) {
      toast({ title: "Could not load", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Countdown
  useEffect(() => {
    if (secondsLeft == null) return;
    if (secondsLeft <= 0) { handleSubmit(true); return; }
    const t = setTimeout(() => setSecondsLeft((s) => (s != null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [secondsLeft]);

  const startQuiz = async (row: AssignmentRow) => {
    try {
      const { data, error } = await supabase.functions.invoke("get-quiz-for-student", { body: { quiz_assignment_id: row.id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const q = (data as any).quiz;
      setTaking({ assignment: row, ...q });
      setAnswers({});
      setResult(null);
      setSecondsLeft(q.time_limit_minutes ? q.time_limit_minutes * 60 : null);
    } catch (e: any) {
      toast({ title: "Could not start", description: e?.message ?? "Try again.", variant: "destructive" });
    }
  };

  const handleSubmit = async (auto = false) => {
    if (!taking || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-quiz", {
        body: { quiz_assignment_id: taking.assignment.id, answers },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data as any);
      setSecondsLeft(null);
      if (auto) toast({ title: "Time's up", description: "Quiz auto-submitted." });
      load();
    } catch (e: any) {
      toast({ title: "Submit failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const finishTaking = () => {
    setTaking(null);
    setResult(null);
    setAnswers({});
    setSecondsLeft(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-student" /></div>;
  }

  // Review past attempt
  if (reviewing) {
    const a = reviewing.attempt;
    return (
      <Card className="dashboard-list-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{reviewing.title} — Attempt #{a.attempt_number}</CardTitle>
              <CardDescription>Score: {a.score} / {a.total}</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setReviewing(null)}>Back</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(a.results || []).map((r: any) => (
            <div key={r.question_id} className={`rounded-md border p-3 ${r.is_correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              <div className="flex items-start gap-2">
                {r.is_correct ? <CheckCircle2 className="h-4 w-4 text-success mt-1" /> : <XCircle className="h-4 w-4 text-destructive mt-1" />}
                <div className="flex-1">
                  <div className="font-medium">Q{r.number}. {r.question}</div>
                  <ul className="mt-1 text-sm">
                    {(r.options || []).map((opt: string, i: number) => {
                      const letter = ["A","B","C","D"][i];
                      const isCorrect = letter === r.correct_option;
                      const isSelected = letter === r.selected;
                      return (
                        <li key={i} className={`${isCorrect ? "font-semibold text-success" : ""} ${isSelected && !isCorrect ? "line-through text-destructive" : ""}`}>{opt}</li>
                      );
                    })}
                  </ul>
                  {r.explanation && <p className="text-xs text-muted-foreground mt-2"><span className="font-semibold">Why: </span>{r.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Result screen
  if (taking && result) {
    return (
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle>{taking.title} — Result</CardTitle>
          <CardDescription>You scored {result.score} / {result.total} (Attempt #{result.attempt_number})</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.results.map((r: any) => (
            <div key={r.question_id} className={`rounded-md border p-3 ${r.is_correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
              <div className="flex items-start gap-2">
                {r.is_correct ? <CheckCircle2 className="h-4 w-4 text-success mt-1" /> : <XCircle className="h-4 w-4 text-destructive mt-1" />}
                <div className="flex-1">
                  <div className="font-medium">Q{r.number}. {r.question}</div>
                  <ul className="mt-1 text-sm">
                    {(r.options || []).map((opt: string, i: number) => {
                      const letter = ["A","B","C","D"][i];
                      const isCorrect = letter === r.correct_option;
                      const isSelected = letter === r.selected;
                      return (
                        <li key={i} className={`${isCorrect ? "font-semibold text-success" : ""} ${isSelected && !isCorrect ? "line-through text-destructive" : ""}`}>{opt}</li>
                      );
                    })}
                  </ul>
                  {r.explanation && <p className="text-xs text-muted-foreground mt-2"><span className="font-semibold">Why: </span>{r.explanation}</p>}
                </div>
              </div>
            </div>
          ))}
          <Button onClick={finishTaking} className="dashboard-btn dashboard-btn-student">Done</Button>
        </CardContent>
      </Card>
    );
  }

  // Taking the quiz
  if (taking) {
    const mm = secondsLeft != null ? Math.floor(secondsLeft / 60) : null;
    const ss = secondsLeft != null ? secondsLeft % 60 : null;
    return (
      <Card className="dashboard-list-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{taking.title}</CardTitle>
              <CardDescription>{taking.instructions || "Select the best answer for each question."}</CardDescription>
            </div>
            {secondsLeft != null && (
              <Badge variant={secondsLeft < 60 ? "destructive" : "outline"} className="text-base">
                <Clock className="h-4 w-4 mr-1" />{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {taking.questions.map((q) => (
            <div key={q.id} className="rounded-md border p-3">
              <div className="font-medium mb-2">Q{q.number}. {q.question}</div>
              <RadioGroup value={answers[q.id] || ""} onValueChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}>
                {q.options.map((opt, i) => {
                  const letter = ["A","B","C","D"][i];
                  const id = `${q.id}-${letter}`;
                  return (
                    <div key={letter} className="flex items-center gap-2">
                      <RadioGroupItem value={letter} id={id} />
                      <Label htmlFor={id} className="cursor-pointer font-normal">{opt}</Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          ))}
          <div className="flex gap-2">
            <Button onClick={() => handleSubmit(false)} disabled={submitting} className="dashboard-btn dashboard-btn-student">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</> : "Submit Quiz"}
            </Button>
            <Button variant="outline" onClick={finishTaking} disabled={submitting}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-student" /> My Quizzes</CardTitle>
        <CardDescription>Quizzes assigned by your teachers.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState icon={ListChecks} title="No quizzes yet" description="Your teachers will assign quizzes here." />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const attempts = r.quiz_attempts || [];
              const used = attempts.length;
              const remaining = r.max_attempts != null ? r.max_attempts - used : null;
              const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
              const total = attempts[0]?.total ?? null;
              const canTake = remaining == null || remaining > 0;
              return (
                <div key={r.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold">{r.quizzes?.title || "Quiz"}</div>
                      <div className="text-xs text-muted-foreground">{[r.quizzes?.subject, r.quizzes?.grade].filter(Boolean).join(" · ")}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Attempts used: {used}{r.max_attempts != null ? ` / ${r.max_attempts}` : " (unlimited)"}
                        {best != null && total != null ? ` · Best: ${best}/${total}` : ""}
                        {r.quizzes?.time_limit_minutes ? ` · Time: ${r.quizzes.time_limit_minutes} min` : ""}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => startQuiz(r)} disabled={!canTake} className="dashboard-btn dashboard-btn-student">
                      <Play className="h-4 w-4 mr-1" />{used === 0 ? "Start" : "Retake"}
                    </Button>
                  </div>
                  {attempts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attempts.map((a) => (
                        <div key={a.id} className="flex items-center justify-between text-xs border-t pt-1">
                          <span>Attempt #{a.attempt_number} · {a.score}/{a.total} · {new Date(a.submitted_at).toLocaleDateString()}</span>
                          <Button size="sm" variant="ghost" onClick={() => setReviewing({ title: r.quizzes?.title || "Quiz", attempt: a })}>
                            <Eye className="h-3 w-3 mr-1" />Review
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
