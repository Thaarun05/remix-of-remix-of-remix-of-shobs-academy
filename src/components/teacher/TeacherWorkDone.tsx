import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { ChevronLeft, ChevronRight, Trash2, Loader2, Send, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISODate(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function diffHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? +(mins / 60).toFixed(2) : 0;
}

type View = "month" | "week" | "day";

export function TeacherWorkDone() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = new Date();
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [view, setView] = useState<View>("month");
  const [weekIndex, setWeekIndex] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthSubmission, setMonthSubmission] = useState<{ status: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    student_user_id: "", start_time: "09:00", end_time: "10:00", topic: "",
  });

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const monthKey = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`;

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

  const loadMonth = async () => {
    if (!user) return;
    setLoading(true);
    const start = toISODate(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = toISODate(cursor.getFullYear(), cursor.getMonth(), lastDay.getDate());
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
    setEntries(((recsRes.data || []) as unknown) as WorkEntry[]);
    setMonthSubmission(subRes.data ? { status: (subRes.data as any).status } : null);
    setLoading(false);
  };

  useEffect(() => { loadMonth(); /* eslint-disable-next-line */ }, [user, cursor]);

  // Build weeks (Mon-Sun) for the month
  const weeks = useMemo(() => {
    const result: { date: Date; inMonth: boolean }[][] = [];
    const firstWeekday = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const d = new Date(firstDay); d.setDate(d.getDate() - (i + 1));
      cells.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let i = 0; i < cells.length; i += 7) result.push(cells.slice(i, i + 7));
    return result;
  }, [cursor]);

  const entriesByDate = useMemo(() => {
    const m = new Map<string, WorkEntry[]>();
    for (const e of entries) {
      const arr = m.get(e.date) || [];
      arr.push(e); m.set(e.date, arr);
    }
    return m;
  }, [entries]);

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
    if (!user || !selectedDate) return;
    if (!form.student_user_id) return toast({ title: "Select a student", variant: "destructive" });
    if (!form.start_time || !form.end_time) return toast({ title: "Set start and end time", variant: "destructive" });
    const hours = diffHours(form.start_time, form.end_time);
    if (hours <= 0) return toast({ title: "End time must be after start time", variant: "destructive" });
    const { error } = await supabase.from("attendance_records").insert({
      student_user_id: form.student_user_id,
      teacher_user_id: user.id,
      date: selectedDate,
      start_time: form.start_time,
      end_time: form.end_time,
      hours,
      topic: form.topic || null,
      status: "present",
    } as any);
    if (error) return toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    toast({ title: "Entry saved" });
    setForm({ ...form, topic: "" });
    loadMonth();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("attendance_records")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) return toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
    toast({ title: "Entry removed" });
    loadMonth();
  };

  const handleSubmitMonth = async () => {
    if (!user) return;
    setSubmitting(true);
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

  // ---------- Level 3: Day View ----------
  if (view === "day" && selectedDate) {
    const dayEntries = entriesByDate.get(selectedDate) || [];
    const d = new Date(selectedDate + "T00:00:00");
    const heading = `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setView("week"); setSelectedDate(null); }}>
          <ArrowLeft className="h-4 w-4" /> Back to Week
        </Button>
        <Card>
          <CardHeader><CardTitle className="text-xl">{heading}</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries logged for this day yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {dayEntries.map(e => {
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
                  <Label>Topic Covered</Label>
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Level 2: Week View ----------
  if (view === "week") {
    const w = weeks[weekIndex];
    if (!w) { setView("month"); return null; }
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setView("month")}>
          <ArrowLeft className="h-4 w-4" /> Back to Weeks
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Week {weekIndex + 1} — {formatWeekRange(w)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-3">
              {w.map((cell, ci) => {
                const iso = toISODate(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
                const isFuture = iso > todayISO;
                const disabled = !cell.inMonth || isFuture;
                const has = entriesByDate.has(iso);
                const dayShort = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][ci];
                return (
                  <button
                    key={ci}
                    disabled={disabled}
                    onClick={() => { setSelectedDate(iso); setView("day"); }}
                    className={`relative h-24 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all
                      ${disabled ? "text-muted-foreground/40 bg-muted/30 cursor-not-allowed" : "hover:border-teacher hover:bg-teacher/5"}
                    `}
                  >
                    <span className="text-xs font-medium">{dayShort}</span>
                    <span className="text-2xl font-semibold">{cell.date.getDate()}</span>
                    {has && cell.inMonth && (
                      <span className="absolute bottom-3 h-2 w-2 rounded-full bg-teacher" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Level 1: Month View ----------
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-xl">{MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {weeks.map((w, i) => {
                const count = weekSessionCounts[i];
                return (
                  <button
                    key={i}
                    onClick={() => { setWeekIndex(i); setView("week"); }}
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
              Submit {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()} work log to admin for review?
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
