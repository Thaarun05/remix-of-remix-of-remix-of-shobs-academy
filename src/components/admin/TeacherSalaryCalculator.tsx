import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calculator, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TeacherOption {
  user_id: string;
  full_name: string | null;
}

interface BreakdownRow {
  student_user_id: string;
  student_name: string;
  classes: number;
  hours: number;
  rate: number | null;
  amount: number;
}

interface Props {
  teachers: TeacherOption[];
  currentUserId: string;
  onSent: () => void;
}

const inr = (n: number) => `Rs. ${n.toFixed(2)}`;

const monthOptions = () => {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: d.toLocaleString("en-US", { month: "long", year: "numeric" }) });
  }
  return out;
};

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
};

const hoursOf = (rec: { hours: number | null; start_time: string | null; end_time: string | null }) => {
  if (rec.hours != null && rec.hours > 0) return Number(rec.hours);
  if (rec.start_time && rec.end_time) {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const diff = toMin(rec.end_time) - toMin(rec.start_time);
    if (diff > 0) return diff / 60;
  }
  return 1;
};

export function TeacherSalaryCalculator({ teachers, currentUserId, onSent }: Props) {
  const { toast } = useToast();
  const months = monthOptions();

  const [teacherId, setTeacherId] = useState("");
  const [month, setMonth] = useState(months[0].value);
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [numClasses, setNumClasses] = useState("");
  const [totalHours, setTotalHours] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [note, setNote] = useState("");

  const calculate = useCallback(async () => {
    if (!teacherId || !month) return;
    setCalculating(true);
    try {
      const { start, end } = monthRange(month);

      // Paginated fetch (Supabase caps responses at 1000 rows)
      const all: { student_user_id: string; hours: number | null; start_time: string | null; end_time: string | null }[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("attendance_records")
          .select("student_user_id, hours, start_time, end_time")
          .eq("teacher_user_id", teacherId)
          .eq("status", "present")
          .is("deleted_at", null)
          .gte("date", start)
          .lte("date", end)
          .range(from, from + PAGE - 1);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < PAGE) break;
      }

      const grouped = new Map<string, { classes: number; hours: number }>();
      all.forEach((r) => {
        const g = grouped.get(r.student_user_id) ?? { classes: 0, hours: 0 };
        g.classes += 1;
        g.hours += hoursOf(r);
        grouped.set(r.student_user_id, g);
      });

      const ids = Array.from(grouped.keys());
      let nameMap = new Map<string, string>();
      let rateMap = new Map<string, number | null>();

      if (ids.length > 0) {
        const [namesRes, settingsRes] = await Promise.all([
          supabase.from("student_profiles").select("user_id, student_name").in("user_id", ids),
          supabase
            .from("student_fee_settings")
            .select("student_user_id, fee_given")
            .eq("teacher_user_id", teacherId)
            .in("student_user_id", ids),
        ]);
        if (namesRes.error) throw namesRes.error;
        if (settingsRes.error) throw settingsRes.error;
        nameMap = new Map((namesRes.data ?? []).map((r) => [r.user_id, r.student_name]));
        rateMap = new Map((settingsRes.data ?? []).map((r) => [r.student_user_id, r.fee_given]));
      }

      const breakdown: BreakdownRow[] = ids
        .map((id) => {
          const g = grouped.get(id)!;
          const rate = rateMap.get(id) ?? null;
          return {
            student_user_id: id,
            student_name: nameMap.get(id) || "Unnamed Student",
            classes: g.classes,
            hours: Math.round(g.hours * 100) / 100,
            rate: rate != null ? Number(rate) : null,
            amount: rate != null ? Math.round(g.hours * Number(rate) * 100) / 100 : 0,
          };
        })
        .sort((a, b) => a.student_name.localeCompare(b.student_name));

      const sumClasses = breakdown.reduce((s, r) => s + r.classes, 0);
      const sumHours = Math.round(breakdown.reduce((s, r) => s + r.hours, 0) * 100) / 100;
      const sumAmount = Math.round(breakdown.reduce((s, r) => s + r.amount, 0) * 100) / 100;

      setRows(breakdown);
      setNumClasses(String(sumClasses));
      setTotalHours(String(sumHours));
      setTotalAmount(String(sumAmount));
      setCalculated(true);
    } catch (error: any) {
      toast({ title: "Could not load work done", description: error.message, variant: "destructive" });
    } finally {
      setCalculating(false);
    }
  }, [teacherId, month, toast]);

  useEffect(() => {
    if (teacherId && month) calculate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, month]);

  const missingRates = rows.filter((r) => r.rate == null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    setSubmitting(true);
    try {
      const teacher = teachers.find((t) => t.user_id === teacherId);
      const hours = parseFloat(totalHours) || 0;
      const amount = parseFloat(totalAmount) || 0;
      const blendedRate = hours > 0 ? Math.round((amount / hours) * 100) / 100 : 0;
      const monthLabel = months.find((m) => m.value === month)?.label ?? month;
      const composedNote = [`Month: ${monthLabel}`, note.trim()].filter(Boolean).join(" — ");

      const { error } = await supabase.from("teacher_salary").insert({
        teacher_id: teacherId,
        teacher_name: teacher?.full_name || null,
        num_classes: parseInt(numClasses) || null,
        total_hours: hours,
        salary_per_hour: blendedRate,
        amount,
        note: composedNote || null,
        status: "sent_to_teacher",
      });
      if (error) throw error;

      await supabase.from("notifications").insert({
        recipient_id: teacherId,
        sender_id: currentUserId,
        type: "salary",
        title: "Salary Details Sent",
        body: `Your salary for ${monthLabel} has been sent. Total amount: ${inr(amount)}`,
        entity_table: "teacher_salary",
      });

      toast({ title: "Salary sent", description: "Salary details have been sent to the teacher." });
      setNote("");
      onSent();
    } catch (error: any) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Teacher Salary Calculator
        </CardTitle>
        <CardDescription>
          Salary is calculated automatically from the teacher's Work Done (attendance) and each student's hourly pay set in Student Fee Settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Teacher *</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.user_id} value={t.user_id}>
                      {t.full_name || t.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Month *</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {teacherId && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Work done breakdown</p>
                <Button type="button" size="sm" variant="outline" onClick={calculate} disabled={calculating}>
                  {calculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" />Recalculate</>}
                </Button>
              </div>

              {calculating ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading work done...
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  {calculated ? "No classes recorded for this teacher in the selected month." : ""}
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="hidden md:grid md:grid-cols-[1fr_70px_70px_100px_110px] gap-2 px-3 text-xs font-medium text-muted-foreground">
                    <span>Student</span>
                    <span>Classes</span>
                    <span>Hours</span>
                    <span>Hourly Pay</span>
                    <span className="text-right">Amount</span>
                  </div>
                  {rows.map((r) => (
                    <div
                      key={r.student_user_id}
                      className="grid grid-cols-2 md:grid-cols-[1fr_70px_70px_100px_110px] gap-2 items-center p-3 rounded-lg border border-border text-sm"
                    >
                      <span className="font-medium truncate">{r.student_name}</span>
                      <span>{r.classes}</span>
                      <span>{r.hours}h</span>
                      <span>
                        {r.rate != null ? inr(r.rate) : <Badge variant="destructive">Rate not set</Badge>}
                      </span>
                      <span className="text-right font-semibold">{inr(r.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {missingRates.length > 0 && (
                <p className="text-xs text-destructive">
                  {missingRates.length} student(s) have no hourly pay set. Set it on the Student Fee Settings page, then recalculate.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Number of Classes</Label>
              <Input type="number" value={numClasses} onChange={(e) => setNumClasses(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Total Hours *</Label>
              <Input type="number" step="0.01" value={totalHours} onChange={(e) => setTotalHours(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Total Amount *</Label>
              <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold text-admin">{inr(parseFloat(totalAmount) || 0)}</p>
            {(parseFloat(totalHours) || 0) > 0 && (
              <p className="text-xs text-muted-foreground">
                Average {inr((parseFloat(totalAmount) || 0) / (parseFloat(totalHours) || 1))} per hour
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              placeholder="Any additional notes..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full dashboard-btn dashboard-btn-admin" disabled={!teacherId || submitting || calculating}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to Teacher"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
