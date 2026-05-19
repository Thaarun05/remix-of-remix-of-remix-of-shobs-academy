import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Teacher { user_id: string; full_name: string | null; }
interface StudentRow { user_id: string; student_name: string; }
interface WorkEntry {
  id: string; date: string; student_user_id: string; teacher_user_id: string;
  start_time: string | null; end_time: string | null; topic: string | null; hours: number | null;
}
interface Submission { id: string; teacher_user_id: string; work_date: string; status: string; submitted_at: string | null; }

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const SHORT_MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAY_SHORT = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISODate(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

type View = "year" | "month" | "week";
const ALL = "__all__";

export function AdminWorkDone() {
  const { toast } = useToast();
  const today = new Date();
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const [view, setView] = useState<View>("year");
  const [year, setYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState<string>(ALL);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [yearEntries, setYearEntries] = useState<WorkEntry[]>([]);
  const [yearSubmissions, setYearSubmissions] = useState<Submission[]>([]);
  const [monthEntries, setMonthEntries] = useState<WorkEntry[]>([]);
  const [monthSubmissions, setMonthSubmissions] = useState<Submission[]>([]);
  const [loadingYear, setLoadingYear] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [approving, setApproving] = useState(false);

  // Load teachers + students once
  useEffect(() => {
    (async () => {
      const [tRes, sRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").eq("role", "teacher"),
        supabase.from("student_profiles").select("user_id, student_name"),
      ]);
      const tList = ((tRes.data || []) as Teacher[]).slice().sort((a, b) =>
        (a.full_name || "").localeCompare(b.full_name || "")
      );
      setTeachers(tList);
      setStudents(((sRes.data || []) as StudentRow[]));
    })();
  }, []);

  // Year-level fetch
  const loadYear = async () => {
    setLoadingYear(true);
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const [recsRes, subRes] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("id, date, student_user_id, teacher_user_id, start_time, end_time, topic, hours")
        .gte("date", start).lte("date", end)
        .is("deleted_at", null),
      supabase
        .from("teacher_work_submissions")
        .select("id, teacher_user_id, work_date, status, submitted_at")
        .gte("work_date", start).lte("work_date", end),
    ]);
    setYearEntries(((recsRes.data || []) as unknown) as WorkEntry[]);
    setYearSubmissions(((subRes.data || []) as unknown) as Submission[]);
    setLoadingYear(false);
  };
  useEffect(() => { loadYear(); /* eslint-disable-next-line */ }, [year]);

  // Month-level fetch
  const loadMonth = async () => {
    setLoadingMonth(true);
    const lastDay = new Date(year, selectedMonth + 1, 0).getDate();
    const start = toISODate(year, selectedMonth, 1);
    const end = toISODate(year, selectedMonth, lastDay);
    const monthAnchor = `${year}-${pad(selectedMonth + 1)}-01`;
    const [recsRes, subRes] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("id, date, student_user_id, teacher_user_id, start_time, end_time, topic, hours")
        .gte("date", start).lte("date", end)
        .is("deleted_at", null),
      supabase
        .from("teacher_work_submissions")
        .select("id, teacher_user_id, work_date, status, submitted_at")
        .eq("work_date", monthAnchor),
    ]);
    setMonthEntries(((recsRes.data || []) as unknown) as WorkEntry[]);
    setMonthSubmissions(((subRes.data || []) as unknown) as Submission[]);
    setLoadingMonth(false);
  };
  useEffect(() => {
    if (view === "month" || view === "week") loadMonth();
    // eslint-disable-next-line
  }, [year, selectedMonth, view]);

  // Only show entries from teachers who have submitted for that month.
  // Key = `${teacher_user_id}|YYYY-MM`
  const submittedKeysYear = useMemo(() => {
    const s = new Set<string>();
    for (const sub of yearSubmissions) s.add(`${sub.teacher_user_id}|${sub.work_date.slice(0, 7)}`);
    return s;
  }, [yearSubmissions]);

  const submittedTeacherIdsThisMonth = useMemo(() => {
    const s = new Set<string>();
    for (const sub of monthSubmissions) s.add(sub.teacher_user_id);
    return s;
  }, [monthSubmissions]);

  const filteredYearEntries = useMemo(() => {
    const onlySubmitted = yearEntries.filter(e =>
      submittedKeysYear.has(`${e.teacher_user_id}|${e.date.slice(0, 7)}`)
    );
    return teacherFilter === ALL
      ? onlySubmitted
      : onlySubmitted.filter(e => e.teacher_user_id === teacherFilter);
  }, [yearEntries, submittedKeysYear, teacherFilter]);

  const filteredMonthEntries = useMemo(() => {
    const onlySubmitted = monthEntries.filter(e => submittedTeacherIdsThisMonth.has(e.teacher_user_id));
    return teacherFilter === ALL
      ? onlySubmitted
      : onlySubmitted.filter(e => e.teacher_user_id === teacherFilter);
  }, [monthEntries, submittedTeacherIdsThisMonth, teacherFilter]);

  const monthCounts = useMemo(() => {
    const arr = new Array(12).fill(0);
    for (const e of filteredYearEntries) {
      const m = parseInt(e.date.slice(5, 7), 10) - 1;
      if (m >= 0 && m < 12) arr[m] += 1;
    }
    return arr;
  }, [filteredYearEntries]);

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
    for (const e of filteredMonthEntries) {
      const arr = m.get(e.date) || [];
      arr.push(e); m.set(e.date, arr);
    }
    return m;
  }, [filteredMonthEntries]);

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

  const teacherName = (id: string) =>
    teachers.find(t => t.user_id === id)?.full_name || "Unknown Teacher";
  const studentName = (id: string) =>
    students.find(s => s.user_id === id)?.student_name || "Unknown Student";

  const selectedSubmission = useMemo(
    () => teacherFilter === ALL ? null : monthSubmissions.find(s => s.teacher_user_id === teacherFilter) || null,
    [monthSubmissions, teacherFilter]
  );

  const handleApprove = async () => {
    if (!selectedSubmission) return;
    setApproving(true);
    const { error } = await supabase
      .from("teacher_work_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
      .eq("id", selectedSubmission.id);
    setApproving(false);
    if (error) return toast({ title: "Failed to approve", description: error.message, variant: "destructive" });
    toast({ title: "Submission approved" });
    loadMonth();
  };

  const TeacherFilter = () => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Teacher:</span>
      <Select value={teacherFilter} onValueChange={(v) => { setTeacherFilter(v); setExpandedDate(null); }}>
        <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Teachers</SelectItem>
          {teachers.map(t => (
            <SelectItem key={t.user_id} value={t.user_id}>{t.full_name || "Unnamed"}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // -------- LEVEL 3: Week View --------
  if (view === "week") {
    const w = weeks[selectedWeek];
    if (!w) { setView("month"); return null; }
    const expandedEntries = expandedDate ? (entriesByDate.get(expandedDate) || []) : [];
    let expandedHeading = "";
    if (expandedDate) {
      const d = new Date(expandedDate + "T00:00:00");
      expandedHeading = `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }

    // Group by teacher when "All Teachers"
    const grouped = new Map<string, WorkEntry[]>();
    for (const e of expandedEntries) {
      const arr = grouped.get(e.teacher_user_id) || [];
      arr.push(e); grouped.set(e.teacher_user_id, arr);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" onClick={() => { setView("month"); setExpandedDate(null); }}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <TeacherFilter />
        </div>
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
                      ${disabled ? "text-muted-foreground/40 bg-muted/30 cursor-not-allowed" : "hover:border-admin hover:bg-admin/5"}
                      ${isActive ? "border-admin bg-admin/10 ring-2 ring-admin/30" : ""}
                    `}
                  >
                    <span className="text-xs font-medium">{DAY_SHORT[ci]}</span>
                    <span className="text-2xl font-semibold">{cell.date.getDate()}</span>
                    {has && cell.inMonth && (
                      <span className="absolute bottom-3 h-2 w-2 rounded-full bg-admin" />
                    )}
                  </button>
                );
              })}
            </div>

            {expandedDate && (
              <div className="rounded-xl border bg-muted/20 p-5 space-y-4">
                <h3 className="font-semibold text-lg">{expandedHeading}</h3>
                {expandedEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No entries logged for this day.</p>
                ) : teacherFilter === ALL ? (
                  <div className="divide-y divide-border">
                    {Array.from(grouped.entries()).map(([tid, items]) => (
                      <div key={tid} className="py-4 first:pt-0 last:pb-0 space-y-2">
                        <p className="font-semibold text-admin">{teacherName(tid)}</p>
                        <div className="divide-y divide-border/50">
                          {items.map(e => (
                            <div key={e.id} className="py-2 first:pt-0 last:pb-0">
                              <p className="font-medium text-sm">{studentName(e.student_user_id)}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {e.start_time || "--"} – {e.end_time || "--"}{e.topic ? ` · ${e.topic}` : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {expandedEntries.map(e => (
                      <div key={e.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="font-semibold text-base">{studentName(e.student_user_id)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {e.start_time || "--"} – {e.end_time || "--"}{e.topic ? ` · ${e.topic}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // -------- LEVEL 2: Month View --------
  if (view === "month") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Button variant="ghost" onClick={() => { setView("year"); setExpandedDate(null); }}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <TeacherFilter />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{MONTH_NAMES[selectedMonth]} {year}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {teacherFilter !== ALL && (
              <div className="rounded-xl border bg-muted/20 p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium">{teacherName(teacherFilter)}</p>
                  {selectedSubmission ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted{selectedSubmission.submitted_at
                        ? ` on ${new Date(selectedSubmission.submitted_at).toLocaleDateString()}`
                        : ""}
                      {" — "}
                      <Badge variant={selectedSubmission.status === "approved" ? "default" : "secondary"} className="ml-1">
                        {selectedSubmission.status}
                      </Badge>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">Not yet submitted</p>
                  )}
                </div>
                {selectedSubmission && selectedSubmission.status !== "approved" && (
                  <Button variant="admin" onClick={handleApprove} disabled={approving}>
                    {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve
                  </Button>
                )}
              </div>
            )}

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
                      className="w-full text-left p-4 rounded-xl border hover:border-admin hover:bg-admin/5 transition-all flex items-center justify-between"
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
      </div>
    );
  }

  // -------- LEVEL 1: Year View --------
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
                        : "hover:border-admin hover:bg-admin/5"}
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