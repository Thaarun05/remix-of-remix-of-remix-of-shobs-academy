import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  ListChecks,
  Play,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Timer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AssignmentRow {
  id: string;
  quiz_id: string;
  max_attempts: number | null;
  assigned_at: string;
  quizzes: {
    title: string;
    subject: string | null;
    grade: string | null;
    time_limit_minutes: number | null;
  } | null;
  quiz_attempts: {
    id: string;
    attempt_number: number;
    score: number | null;
    total: number | null;
    submitted_at: string | null;
    status: string | null;
    results: any;
    total_time_spent_seconds: number | null;
  }[];
}

interface QuestionMeta {
  id: string;
  number: number;
  topic: string | null;
}
interface ActiveQuestion {
  id: string;
  number: number;
  topic: string | null;
  question: string;
  options: string[];
}
interface AnswersSummary {
  selected: Record<string, string | null>;
  time_spent: Record<string, number>;
}
interface AttemptSession {
  attempt_id: string;
  attempt_number: number;
  quiz: {
    id: string;
    title: string;
    subject: string | null;
    grade: string | null;
    instructions: string | null;
    time_limit_minutes: number | null;
  };
  assignment: AssignmentRow;
  questions_meta: QuestionMeta[];
  questions_full: ActiveQuestion[];
  active_question_index: number;
  furthest_question_index: number;
  active_question: ActiveQuestion;
  selected_option: string | null;
  answers_summary: AnswersSummary;
  time_remaining_seconds: number | null;
  server_synced_at: number;
  quiz_started_at_local: number;
  prior_elapsed_seconds: number;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function StudentQuizzes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AssignmentRow[]>([]);

  const [session, setSession] = useState<AttemptSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    total: number;
    results: any[];
    attempt_number: number;
    total_time_spent_seconds: number;
    title: string;
  } | null>(null);
  const [reviewing, setReviewing] = useState<{ title: string; attempt: any } | null>(null);

  // Live tickers
  const [tick, setTick] = useState(0);
  const questionOpenedAt = useRef<number>(Date.now());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user?.id]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("quiz_assignments")
        .select(
          "id, quiz_id, max_attempts, assigned_at, quizzes(title, subject, grade, time_limit_minutes), quiz_attempts(id, attempt_number, score, total, submitted_at, status, results, total_time_spent_seconds)",
        )
        .eq("student_user_id", user.id)
        .is("deleted_at", null)
        .order("assigned_at", { ascending: false });
      if (error) throw error;
      setRows(((data as any) || []) as AssignmentRow[]);
    } catch (e: any) {
      toast({
        title: "Could not load",
        description: e?.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 1s ticker while taking a quiz
  useEffect(() => {
    if (!session || result) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [session, result]);

  // Derived: displayed countdown remaining
  const displayedRemaining = useMemo(() => {
    if (!session || session.time_remaining_seconds == null) return null;
    const drift = (Date.now() - session.server_synced_at) / 1000;
    return Math.max(0, session.time_remaining_seconds - drift);
  }, [session, tick]);

  // Auto-submit at zero
  useEffect(() => {
    if (!session || result || submittedRef.current) return;
    if (displayedRemaining != null && displayedRemaining <= 0) {
      submittedRef.current = true;
      handleSubmit(true);
    }
    // eslint-disable-next-line
  }, [displayedRemaining, session, result]);

  // Derived: total stopwatch for the whole quiz (elapsed since attempt started)
  const stopwatchSeconds = useMemo(() => {
    if (!session) return 0;
    const local = Math.floor((Date.now() - session.quiz_started_at_local) / 1000);
    return session.prior_elapsed_seconds + local;
  }, [session, tick]);

  const startQuiz = async (row: AssignmentRow) => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("start-quiz-attempt", {
        body: { quiz_assignment_id: row.id },
      });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) throw new Error(payload.error);
      if (payload?.expired) {
        // Time already gone — submit immediately to finalize
        const { data: sub } = await supabase.functions.invoke("submit-quiz", {
          body: { attempt_id: payload.attempt_id },
        });
        toast({ title: "Time's up", description: "Attempt auto-submitted." });
        setResult({ ...(sub as any), title: row.quizzes?.title || "Quiz" });
        load();
        return;
      }
      submittedRef.current = false;
      questionOpenedAt.current = Date.now();
      const priorElapsed = Object.values(
        (payload.answers_summary?.time_spent as Record<string, number>) || {},
      ).reduce((s, v) => s + (v || 0), 0);
      setSession({
        ...payload,
        assignment: row,
        server_synced_at: Date.now(),
        quiz_started_at_local: Date.now(),
        prior_elapsed_seconds: priorElapsed,
      });
      setResult(null);
    } catch (e: any) {
      toast({
        title: "Could not start",
        description: e?.message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setStarting(false);
    }
  };

  const goToIndex = (target: number) => {
    if (!session || submitting) return;
    if (target === session.active_question_index) return;
    if (target < 0 || target >= session.questions_meta.length) return;
    // Optimistic, instant navigation using preloaded questions
    const targetQ = session.questions_full[target];
    if (!targetQ) return;
    questionOpenedAt.current = Date.now();
    setSession((prev) =>
      prev
        ? {
            ...prev,
            active_question_index: target,
            furthest_question_index: Math.max(prev.furthest_question_index, target),
            active_question: targetQ,
            selected_option: prev.answers_summary.selected[targetQ.id] ?? null,
          }
        : prev,
    );
    // Fire server-side timing sync in background (non-blocking)
    const attemptId = session.attempt_id;
    supabase.functions
      .invoke("go-to-question", {
        body: { attempt_id: attemptId, target_index: target },
      })
      .then(({ data }) => {
        const payload = data as any;
        if (!payload || payload.error) return;
        setSession((prev) => {
          if (!prev || prev.attempt_id !== attemptId) return prev;
          // Only refresh timing/answers metadata; do not clobber active question UI
          return {
            ...prev,
            answers_summary: payload.answers_summary ?? prev.answers_summary,
            time_remaining_seconds:
              payload.time_remaining_seconds ?? prev.time_remaining_seconds,
            server_synced_at: Date.now(),
          };
        });
      })
      .catch(() => {
        /* silent; navigation already happened */
      });
  };

  const onSelectOption = (option: string) => {
    if (!session) return;
    const qid = session.active_question.id;
    // Optimistic UI
    setSession((prev) =>
      prev
        ? {
            ...prev,
            selected_option: option,
            answers_summary: {
              ...prev.answers_summary,
              selected: { ...prev.answers_summary.selected, [qid]: option },
            },
          }
        : prev,
    );
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("save-answer", {
          body: { attempt_id: session.attempt_id, question_id: qid, selected_option: option },
        });
        if (error) throw error;
        const payload = data as any;
        if (payload?.time_remaining_seconds != null) {
          setSession((prev) =>
            prev
              ? {
                  ...prev,
                  time_remaining_seconds: payload.time_remaining_seconds,
                  server_synced_at: Date.now(),
                }
              : prev,
          );
        }
      } catch (e: any) {
        toast({
          title: "Answer not saved",
          description: e?.message ?? "Retrying on next change.",
          variant: "destructive",
        });
      }
    }, 350);
  };

  const handleSubmit = useCallback(
    async (auto = false) => {
      if (!session || submitting) return;
      setSubmitting(true);
      try {
        // Flush pending save
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
          debounceRef.current = null;
        }
        const { data, error } = await supabase.functions.invoke("submit-quiz", {
          body: { attempt_id: session.attempt_id },
        });
        if (error) throw error;
        const payload = data as any;
        if (payload?.error) throw new Error(payload.error);
        setResult({ ...payload, title: session.quiz.title });
        if (auto) toast({ title: "Time's up", description: "Quiz auto-submitted." });
        load();
      } catch (e: any) {
        toast({
          title: "Submit failed",
          description: e?.message ?? "Try again.",
          variant: "destructive",
        });
      } finally {
        setSubmitting(false);
        setSubmitConfirmOpen(false);
      }
    },
    // eslint-disable-next-line
    [session, submitting],
  );

  const attemptSubmit = () => {
    if (!session) return;
    const unanswered = session.questions_meta.filter(
      (q) => !session.answers_summary.selected[q.id],
    ).length;
    if (unanswered > 0) setSubmitConfirmOpen(true);
    else handleSubmit(false);
  };

  const finishTaking = () => {
    setSession(null);
    setResult(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-student" />
      </div>
    );
  }

  // Review a past attempt
  if (reviewing) {
    const a = reviewing.attempt;
    return (
      <Card className="dashboard-list-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {reviewing.title} — Attempt #{a.attempt_number}
              </CardTitle>
              <CardDescription>
                Score: {a.score} / {a.total}
                {a.total_time_spent_seconds != null
                  ? ` · Total time: ${formatClock(a.total_time_spent_seconds)}`
                  : ""}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Back
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(a.results || []).map((r: any) => (
            <ReviewCard key={r.question_id} r={r} />
          ))}
        </CardContent>
      </Card>
    );
  }

  // Result screen (just submitted)
  if (session && result) {
    return (
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle>{result.title} — Result</CardTitle>
          <CardDescription>
            You scored {result.score} / {result.total} (Attempt #{result.attempt_number}) · Total
            time: {formatClock(result.total_time_spent_seconds)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.results.map((r: any) => (
            <ReviewCard key={r.question_id} r={r} />
          ))}
          <Button onClick={finishTaking} className="dashboard-btn dashboard-btn-student">
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Taking the quiz
  if (session) {
    const q = session.active_question;
    const idx = session.active_question_index;
    const total = session.questions_meta.length;
    const remainingLabel = displayedRemaining != null ? formatClock(displayedRemaining) : null;

    return (
      <>
        <Card className="dashboard-list-card">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <CardTitle>{session.quiz.title}</CardTitle>
                <CardDescription>
                  {session.quiz.instructions || "Select the best answer for each question."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {remainingLabel != null && (
                  <Badge
                    variant={displayedRemaining! < 60 ? "destructive" : "outline"}
                    className="text-base"
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    {remainingLabel}
                  </Badge>
                )}
                <Badge variant="outline" className="text-base">
                  <Timer className="h-4 w-4 mr-1" />
                  {formatClock(stopwatchSeconds)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nav grid */}
            <div className="flex flex-wrap gap-1.5">
              {session.questions_meta.map((qm, i) => {
                const answered = !!session.answers_summary.selected[qm.id];
                const active = i === idx;
                return (
                  <button
                    key={qm.id}
                    onClick={() => goToIndex(i)}
                    disabled={submitting}
                    className={[
                      "h-8 w-8 rounded-md text-xs font-medium border transition-colors",
                      active
                        ? "bg-student text-white border-student ring-2 ring-student/40"
                        : answered
                          ? "bg-student/10 text-student border-student/40 hover:bg-student/20"
                          : "bg-background text-muted-foreground border-border hover:bg-muted",
                    ].join(" ")}
                    title={`Question ${i + 1}${answered ? " (answered)" : ""}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Question */}
            <div className="rounded-md border p-4">
              <div className="text-xs text-muted-foreground mb-1">
                Question {idx + 1} of {total}
                {q.topic ? ` · ${q.topic}` : ""}
              </div>
              <div className="font-medium mb-3">{q.question}</div>
              <RadioGroup
                value={session.selected_option || ""}
                onValueChange={(v) => onSelectOption(v)}
              >
                {q.options.map((opt, i) => {
                  const letter = ["A", "B", "C", "D"][i];
                  const id = `${q.id}-${letter}`;
                  return (
                    <div key={letter} className="flex items-center gap-2 py-1">
                      <RadioGroupItem value={letter} id={id} />
                      <Label htmlFor={id} className="cursor-pointer font-normal">
                        <span className="font-semibold mr-1">{letter}.</span>
                        {opt}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Prev / Next / Submit */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t sticky bottom-0 bg-background/80 backdrop-blur py-3 -mx-6 px-6">
              <Button
                variant="outline"
                onClick={() => goToIndex(idx - 1)}
                disabled={idx === 0 || submitting}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="text-xs text-muted-foreground">
                {Object.values(session.answers_summary.selected).filter(Boolean).length} / {total}{" "}
                answered
              </div>
              {idx < total - 1 ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={attemptSubmit}
                    disabled={submitting}
                    className="text-destructive"
                  >
                    Submit
                  </Button>
                  <Button
                    onClick={() => goToIndex(idx + 1)}
                    disabled={submitting}
                    className="dashboard-btn dashboard-btn-student"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={attemptSubmit}
                  disabled={submitting}
                  className="dashboard-btn dashboard-btn-student"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Submitting…
                    </>
                  ) : (
                    "Submit Quiz"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit quiz?</AlertDialogTitle>
              <AlertDialogDescription>
                {(() => {
                  const un = session.questions_meta.filter(
                    (qm) => !session.answers_summary.selected[qm.id],
                  ).length;
                  return `${un} question${un === 1 ? "" : "s"} unanswered — submit anyway?`;
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Keep answering</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleSubmit(false)} disabled={submitting}>
                Submit anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // List of quizzes
  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-student" /> My Quizzes
        </CardTitle>
        <CardDescription>Quizzes assigned by your teachers.</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No quizzes yet"
            description="Your teachers will assign quizzes here."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const submittedAttempts = (r.quiz_attempts || []).filter(
                (a) => a.status === "submitted" || a.status == null && a.submitted_at,
              );
              const inProgress = (r.quiz_attempts || []).find((a) => a.status === "in_progress");
              const used = submittedAttempts.length;
              const remaining = r.max_attempts != null ? r.max_attempts - used : null;
              const scored = submittedAttempts.filter((a) => a.score != null);
              const best = scored.length ? Math.max(...scored.map((a) => a.score as number)) : null;
              const total = scored[0]?.total ?? null;
              const canTake = remaining == null || remaining > 0 || !!inProgress;
              const label = inProgress ? "Resume" : used === 0 ? "Start" : "Retake";
              return (
                <div key={r.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-semibold">{r.quizzes?.title || "Quiz"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.quizzes?.subject, r.quizzes?.grade].filter(Boolean).join(" · ")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Attempts used: {used}
                        {r.max_attempts != null ? ` / ${r.max_attempts}` : " (unlimited)"}
                        {best != null && total != null ? ` · Best: ${best}/${total}` : ""}
                        {r.quizzes?.time_limit_minutes
                          ? ` · Time: ${r.quizzes.time_limit_minutes} min`
                          : ""}
                        {inProgress ? " · In progress" : ""}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => startQuiz(r)}
                      disabled={!canTake || starting}
                      className="dashboard-btn dashboard-btn-student"
                    >
                      {starting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Play className="h-4 w-4 mr-1" />
                      )}
                      {label}
                    </Button>
                  </div>
                  {submittedAttempts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {submittedAttempts.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-xs border-t pt-1"
                        >
                          <span>
                            Attempt #{a.attempt_number} · {a.score}/{a.total}
                            {a.total_time_spent_seconds != null
                              ? ` · ${formatClock(a.total_time_spent_seconds)}`
                              : ""}
                            {a.submitted_at
                              ? ` · ${new Date(a.submitted_at).toLocaleDateString()}`
                              : ""}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setReviewing({ title: r.quizzes?.title || "Quiz", attempt: a })
                            }
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Review
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

function ReviewCard({ r }: { r: any }) {
  return (
    <div
      className={`rounded-md border p-3 ${
        r.is_correct ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex items-start gap-2">
        {r.is_correct ? (
          <CheckCircle2 className="h-4 w-4 text-success mt-1" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive mt-1" />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium">
              Q{r.number}. {r.question}
            </div>
            {r.time_spent_seconds != null && (
              <Badge variant="outline" className="text-[10px]">
                <Timer className="h-3 w-3 mr-1" />
                {formatClock(r.time_spent_seconds)}
              </Badge>
            )}
          </div>
          <ul className="mt-1 text-sm">
            {(r.options || []).map((opt: string, i: number) => {
              const letter = ["A", "B", "C", "D"][i];
              const isCorrect = letter === r.correct_option;
              const isSelected = letter === r.selected;
              return (
                <li
                  key={i}
                  className={`${isCorrect ? "font-semibold text-success" : ""} ${
                    isSelected && !isCorrect ? "line-through text-destructive" : ""
                  }`}
                >
                  <span className="font-semibold mr-1">{letter}.</span>
                  {opt}
                </li>
              );
            })}
          </ul>
          {r.explanation && (
            <p className="text-xs text-muted-foreground mt-2">
              <span className="font-semibold">Why: </span>
              {r.explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}