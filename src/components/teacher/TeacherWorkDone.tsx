import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { ChevronLeft, ChevronRight, ArrowLeft, Trash2, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Student { user_id: string; student_name: string; }
interface WorkEntry {
  id: string; date: string; student_user_id: string;
  start_time: string | null; end_time: string | null; topic: string | null; hours: number | null;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const SHORT_MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISODate(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function diffHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? +(mins / 60).toFixed(2) : 0;
}

type View = "year" | "month" | "week";

export function TeacherWorkDone() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = new Date();
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const [view, setView] = useState<View>("year");
  const [year, setYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth()); // 0-11
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [yearEntries, setYearEntries] = useState<WorkEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<WorkEntry[]>([]);
  const [monthSubmission, setMonthSubmission] = useState<{ status: string } | null>(null);
  const [loadingYear, setLoadingYear] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    student_user_id: "", start_time: "09:00", end_time: "10:00", topic: "",
  });

  // Load students once
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: assignments } = await supabase
        .from("student_teacher_assignments")
        .select("student_user_id")
        .eq("teacher_user_id", user.id);
      const ids = (assignments || []).map((a: any) => a.student_user_id);
      if (ids.length === 0) { setStudents([]); return; }
      const { data: profs } = await supabase
        .from("student_profiles")
        .select("user_id, student_name")
        .in("user_id", ids);
      const list = (profs || []).map((p: any) => ({ user_id: p.user_id, student_name: p.student_name }));
      list.sort((a, b) => a.student_name.localeCompare(b.student_name));
      setStudents(list);
    })();
  }, [user]);

  // Load year entries (for month badges in Level 1)
  const loadYear = async () => {
    if (!user) return;
    setLoadingYear(true);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const { data } = await supabase
      .from("attendance_records")
      .select("id, date, student_user_id, start_time, end_time, topic, hours")
      .eq("teacher_user_id", user.id)
      .gte("date", start).lte("date", end)
      .is("deleted_at", null);
    setYearEntries(((data || []) as unknown) as WorkEntry[]);
    setLoadingYear(false);
  };
  useEffect(() => { loadYear(); /* eslint-disable-next-line */ }, [user, year]);

  // Load month entries + submission (Level 2/3)
  const loadMonth = async () => {
    if (!user) return;
    setLoadingMonth(true);
    const lastDay = new Date(year, selectedMonth + 1, 0).getDate();
    const start = toISODate(year, selectedMonth, 1);
    const end = toISODate(year, selectedMonth, lastDay);
    const monthKey = `${year}-${pad(selectedMonth + 1)}`;
    const [recsRes, subRes] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("id, date, student_user_id, start_time, end_time, topic, hours")
        .eq("teacher_user_id", user.id)
        .gte("date", start).lte("date", end)
        .is("deleted_at", null),
      supabase
        .from("teacher_work_submissions")
        .select("status")
        .eq("teacher_user_id", user.id)
        .eq("work_date", `${monthKey}-01`)
        .maybeSingle(),
    ]);
    setMonthEntries(((recsRes.data || []) as unknown) as WorkEntry[]);
    setMonthSubmission(subRes.data ? { status: (subRes.data as any).status } : null);
    setLoadingMonth(false);
  };
  useEffect(() => {
    if (view === "month" || view === "week") loadMonth();
    // eslint-disable-next-line
  }, [user, year, selectedMonth, view]);

  // Year-level: count per month
  const monthCounts = useMemo(() => {
    const arr = new Array(12).fill(0);
    for (const e of yearEntries) {
      const m = parseInt(e.date.slice(5, 7), 10) - 1;
      if (m >= 0 && m < 12) arr[m] += 1;
    }
    return arr;
  }, [yearEntries]);

  // Build weeks of selectedMonth (Mon-Sun)
  const weeks = useMemo(() => {
    const firstDay = new Date(year, selectedMonth, 1);
    const lastDay = new Date(year, selectedMonth + 1, 0);
    const result: { date: Date; inMonth: boolean }[][] = [];
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = new Date(firstDay); d.setDate(d.getDate() - (i + 1));
      cells.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      cells.push({ date: new Date(year, selectedMonth, d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [year, selectedMonth]);

  const entriesByDate = useMemo(() => {
    const m = new Map<string, WorkEntry[]>();
    for (const e of monthEntries) {
      const arr = m.get(e.date) || [];
      arr.push(e); m.set(e.date, arr);
    }
    return m;
  }, [monthEntries]);

  const weekSessionCounts = useMemo(() => {
    return weeks.map(w => {
      let count = 0;
      for (const c of w) {
        if (!c.inMonth) continue;
        const iso = toISODate(c.date.getFullYear(), c.date.getMonth(), c.date.getDate());
        count += (entriesByDate.get(iso)?.length || 0);
      }
      return count;
    });
  }, [weeks, entriesByDate]);

  const formatWeekRange = (w: { date: Date; inMonth: boolean }[]) => {
    const inMonthDays = w.filter(c => c.inMonth).map(c => c.date);
    const start = inMonthDays[0] ?? w[0].date;
    const end = inMonthDays[inMonthDays.length - 1] ?? w[6].date;
    return `${SHORT_MONTH[start.getMonth()]} ${start.getDate()} to ${SHORT_MONTH[end.getMonth()]} ${end.getDate()}`;
  };

  const handleSave = async () => {
    if (!user || !expandedDate) return;
    if (!form.student_user_id) return toast({ title: "Select a student", variant: "destructive" });
    if (!form.start_time || !form.end_time) return toast({ title: "Set start and end time", variant: "destructive" });
    const hours = diffHours(form.start_time, form.end_time);
    if (hours <= 0) return toast({ title: "End time must be after start time", variant: "destructive" });
    const { error } = await supabase.from("attendance_records").insert({
      student_user_id: form.student_user_id,
      teacher_user_id: user.id,
      date: expandedDate,
      start_time: form.start_time,
      end_time: form.end_time,
      hours,
      topic: form.topic || null,
      status: "present",
    } as any);
    if (error) return toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    toast({ title: "Entry saved" });
    setForm({ ...form, topic: "" });
    loadMonth(); loadYear();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("attendance_records")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) return toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    toast({ title: "Entry removed" });
    loadMonth(); loadYear();
  };

  const handleSubmitMonth = async () => {
    if (!user) return;
    setSubmitting(true);
    const monthKey = `${year}-${pad(selectedMonth + 1)}`;
    const { error } = await supabase
      .from("teacher_work_submissions")
      .upsert({
        teacher_user_id: user.id,
        work_date: `${monthKey}-01`,
        status: "pending",
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
      } as any, { onConflict: "teacher_user_id,work_date" });
    setSubmitting(false);
    setConfirmOpen(false);
    if (error) return toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    toast({ title: "Submitted to admin" });
    loadMonth();
  };

  // ---------------- LEVEL 3: Week View ----------------
  if (view === "week") {
    const w = weeks[selectedWeek];
    if (!w) { setView("month"); return null; }
    const expandedEntries = expandedDate ? (entriesByDate.get(expandedDate) || []) : [];
    let expandedHeading = "";
    if (expandedDate) {
      const d = new Date(expandedDate + "T00:00:00");
      expandedHeading = `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setView("month"); setExpandedDate(null); }}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Week {selectedWeek + 1} — {formatWeekRange(w)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-7 gap-3">
              {w.map((cell, ci) => {
                const iso = toISODate(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
                const isFuture = iso > todayISO;
                const disabled = !cell.inMonth || isFuture;
                const has = entriesByDate.has(iso);
                const isActive = expandedDate === iso;
                return (
                  <button
                    key={ci}
                    disabled={disabled}
                    onClick={() => setExpandedDate(isActive ? null : iso)}
                    className={`relative h-24 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all
                      ${disabled ? "text-muted-foreground/40 bg-muted/30 cursor-not-allowed" : "hover:border-teacher hover:bg-teacher/5"}
                      ${isActive ? "border-teacher bg-teacher/10 ring-2 ring-teacher/30" : ""}
                    `}
                  >
                    <span className="text-xs font-medium">{DAY_SHORT[ci]}</span>
                    <span className="text-2xl font-semibold">{cell.date.getDate()}</span>
                    {has && cell.inMonth && (
                      <span className="absolute bottom-3 h-2 w-2 rounded-full bg-teacher" />
                    )}
                  </button>
                );
              })}
            </div>

            {expandedDate && (
              <div className="rounded-xl border bg-muted/20 p-5 space-y-5">
                <h3 className="font-semibold text-lg">{expandedHeading}</h3>

                {expandedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries logged for this day yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {expandedEntries.map(e => {
                      const sName = students.find(s => s.user_id === e.student_user_id)?.student_name || "Unknown";
                      return (
                        <div key={e.id} className="flex items-start justify-between py-3 first:pt-0 last:pb-0">
                          <div className="flex flex-col">
                            <span className="font-semibold text-base">{sName}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">
                              {e.start_time || "--"} – {e.end_time || "--"}{e.topic ? ` · ${e.topic}` : ""}
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t space-y-4">
                  <h4 className="font-medium">Add Entry</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Student</Label>
                      <Select value={form.student_user_id} onValueChange={(v) => setForm({ ...form, student_user_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                        <SelectContent>
                          {students.map(s => (
                            <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Topic</Label>
                      <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Algebra basics" />
                    </div>
                    <div>
                      <Label>Start Time</Label>
                      <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                    </div>
                  </div>
                  <Button onClick={handleSave} variant="teacher">Save Entry</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------------- LEVEL 2: Month View ----------------
  if (view === "month") {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setView("year"); setExpandedDate(null); }}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{MONTH_NAMES[selectedMonth]} {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMonth ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                {weeks.map((w, i) => {
                  const count = weekSessionCounts[i];
                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedWeek(i); setExpandedDate(null); setView("week"); }}
                      className="w-full text-left p-4 rounded-xl border hover:border-teacher hover:bg-teacher/5 transition-all flex items-center justify-between"
                    >
                      <div>
                        <p className="font-semibold">Week {i + 1}</p>
                        <p className="text-sm text-muted-foreground">{formatWeekRange(w)}</p>
                      </div>
                      {count > 0 && (
                        <Badge variant="secondary">{count} session{count === 1 ? "" : "s"}</Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium">Monthly submission</p>
              <p className="text-xs text-muted-foreground italic mt-0.5">
                * After you complete all classes for the month, please submit this to the admin.
              </p>
              {monthSubmission && (
                <Badge variant={monthSubmission.status === "approved" ? "default" : "secondary"} className="mt-2">
                  {monthSubmission.status === "approved" ? "Approved" : "Submitted — Pending Review"}
                </Badge>
              )}
            </div>
            {!monthSubmission && (
              <Button onClick={() => setConfirmOpen(true)} variant="teacher">
                <Send className="h-4 w-4" /> Submit to Admin
              </Button>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Submit work log?</AlertDialogTitle>
              <AlertDialogDescription>
                Submit {MONTH_NAMES[selectedMonth]} {year} work log to admin for review?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmitMonth} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ---------------- LEVEL 1: Year View ----------------
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setYear(year - 1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-2xl">{year}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setYear(year + 1)}
              disabled={year >= today.getFullYear()}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingYear ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {MONTH_NAMES.map((mName, mi) => {
                const isFuture = year > today.getFullYear() || (year === today.getFullYear() && mi > today.getMonth());
                const count = monthCounts[mi];
                return (
                  <button
                    key={mi}
                    disabled={isFuture}
                    onClick={() => { setSelectedMonth(mi); setExpandedDate(null); setView("month"); }}
                    className={`relative p-5 rounded-xl border transition-all text-left
                      ${isFuture
                        ? "text-muted-foreground/40 bg-muted/30 cursor-not-allowed"
                        : "hover:border-teacher hover:bg-teacher/5"}
                    `}
                  >
                    <p className="font-semibold text-base">{mName}</p>
                    {count > 0 && !isFuture && (
                      <Badge variant="secondary" className="mt-2">{count} session{count === 1 ? "" : "s"}</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}