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
import { ChevronLeft, ChevronRight, Trash2, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Student {
  user_id: string;
  student_name: string;
}

interface WorkEntry {
  id: string;
  date: string;
  student_user_id: string;
  start_time: string | null;
  end_time: string | null;
  topic: string | null;
  hours: number | null;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISODate(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
function diffHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? +(mins / 60).toFixed(2) : 0;
}

export function TeacherWorkDone() {
  const { user } = useAuth();
  const { toast } = useToast();

  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [students, setStudents] = useState<Student[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Map<string, string>>(new Map());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    student_user_id: "",
    start_time: "09:00",
    end_time: "10:00",
    topic: "",
  });

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  // Load assigned students
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

  // Load entries + submission for current month
  const loadMonth = async () => {
    if (!user) return;
    setLoading(true);
    const start = toISODate(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = toISODate(cursor.getFullYear(), cursor.getMonth(), lastDay.getDate());
    const [recsRes, subsRes] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("id, date, student_user_id, start_time, end_time, topic, hours")
        .eq("teacher_user_id", user.id)
        .gte("date", start)
        .lte("date", end)
        .is("deleted_at", null),
      supabase
        .from("teacher_work_submissions")
        .select("work_date, status")
        .eq("teacher_user_id", user.id)
        .gte("work_date", start)
        .lte("work_date", end),
    ]);
    setEntries(((recsRes.data || []) as unknown) as WorkEntry[]);
    const subMap = new Map<string, string>();
    ((subsRes.data || []) as any[]).forEach((s) => subMap.set(s.work_date, s.status));
    setSubmissions(subMap);
    setLoading(false);
  };

  useEffect(() => { loadMonth(); /* eslint-disable-next-line */ }, [user, cursor]);

  // Build weeks (Mon-Sun)
  const weeks = useMemo(() => {
    const result: ({ date: Date; inMonth: boolean } | null)[][] = [];
    const firstWeekday = (firstDay.getDay() + 6) % 7; // Mon=0
    const totalDays = lastDay.getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    // leading
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
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [entries]);

  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const handleSave = async () => {
    if (!user || !selectedDate) return;
    if (!form.student_user_id) {
      toast({ title: "Select a student", variant: "destructive" });
      return;
    }
    if (!form.start_time || !form.end_time) {
      toast({ title: "Set start and end time", variant: "destructive" });
      return;
    }
    const hours = diffHours(form.start_time, form.end_time);
    if (hours <= 0) {
      toast({ title: "End time must be after start time", variant: "destructive" });
      return;
    }
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
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Entry saved" });
    setForm({ ...form, topic: "" });
    loadMonth();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("attendance_records")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Entry removed" });
    loadMonth();
  };

  const handleSubmit = async () => {
    if (!user || !selectedDate) return;
    setSubmitting(true);
    const { error } = await supabase.from("teacher_work_submissions").insert({
      teacher_user_id: user.id,
      work_date: selectedDate,
      status: "pending",
    } as any);
    setSubmitting(false);
    setConfirmOpen(false);
    if (error) {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Day submitted to admin" });
    loadMonth();
  };

  const selectedEntries = selectedDate ? (entriesByDate.get(selectedDate) || []) : [];
  const selectedSubmissionStatus = selectedDate ? submissions.get(selectedDate) : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-xl">
              {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground mb-2">
            {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
              <div key={d} className="text-center">{d}</div>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-2 mb-2">
              {week.map((cell, ci) => {
                const iso = toISODate(cell!.date.getFullYear(), cell!.date.getMonth(), cell!.date.getDate());
                const isFuture = iso > todayISO;
                const disabled = !cell!.inMonth || isFuture;
                const has = entriesByDate.has(iso);
                const isSelected = selectedDate === iso;
                return (
                  <button
                    key={ci}
                    disabled={disabled}
                    onClick={() => setSelectedDate(iso)}
                    className={`relative h-16 rounded-lg border text-sm transition-all flex flex-col items-center justify-center
                      ${disabled ? "text-muted-foreground/40 bg-muted/30 cursor-not-allowed" : "hover:border-teacher hover:bg-teacher/5"}
                      ${isSelected ? "border-teacher bg-teacher/10" : "border-border"}
                    `}
                  >
                    <span className="font-medium">{cell!.date.getDate()}</span>
                    {has && cell!.inMonth && (
                      <span className="absolute bottom-2 h-1.5 w-1.5 rounded-full bg-teacher" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>

      {selectedDate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Entries for {selectedDate}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : selectedEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No entries logged for this day yet.</p>
            ) : (
              <div className="space-y-2">
                {selectedEntries.map((e) => {
                  const sName = students.find(s => s.user_id === e.student_user_id)?.student_name || "Unknown";
                  return (
                    <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex flex-col">
                        <span className="font-medium">{sName}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.start_time || "--"} – {e.end_time || "--"} {e.topic ? `· ${e.topic}` : ""}
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

            <div className="pt-4 border-t flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-sm font-medium">Daily submission</p>
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  * After you complete all classes for the day, please submit this to the admin.
                </p>
                {selectedSubmissionStatus ? (
                  <Badge variant={selectedSubmissionStatus === "approved" ? "default" : "secondary"} className="mt-1">
                    {selectedSubmissionStatus === "approved" ? "Approved" : "Submitted — Pending Review"}
                  </Badge>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Not yet submitted for {selectedDate}</p>
                )}
              </div>
              <Button onClick={() => setConfirmOpen(true)} variant="teacher" disabled={selectedEntries.length === 0}>
                <Send className="h-4 w-4" />
                {selectedSubmissionStatus ? "Send Once More" : "Submit to Admin"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit work log?</AlertDialogTitle>
            <AlertDialogDescription>
              Submit work log for {selectedDate} to admin for review?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}