import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { parentSidebarItems } from "@/components/dashboard/DashboardSidebar";
import { StatCard } from "@/components/dashboard/StatCard";
import { StudentAttendanceHistory } from "@/components/student/StudentAttendanceHistory";
import { StudentNotes } from "@/components/student/StudentNotes";
import { StudentWhiteboards } from "@/components/student/StudentWhiteboards";
import { StudentCalendar } from "@/components/StudentCalendar";
import { ParentAdminMessaging } from "@/components/messaging/ParentAdminMessaging";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { DueDateChip } from "@/components/ui/due-date-chip";
import { SkeletonList, SkeletonStats } from "@/components/ui/loading-skeletons";
import { Seo } from "@/components/Seo";
import {
  Calendar,
  CheckCircle2,
  FileText,
  ListChecks,
  Receipt,
  GraduationCap,
  Eye,
} from "lucide-react";

interface Child {
  user_id: string;
  student_name: string;
  grade: string | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
}

interface Assignment {
  id: string;
  title: string;
  subject: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
}

interface QuizRow {
  id: string;
  quiz_id: string;
  max_attempts: number | null;
  quizzes: { title: string | null; subject: string | null } | null;
  attempts: { score: number | null; total: number | null; status: string; submitted_at: string | null }[];
}

interface FeeRow {
  id: string;
  month: string;
  total_hours: number | null;
  final_amount: number | null;
  total_amount: number | null;
  status: string | null;
  created_at: string;
}

const formatINR = (value: number | null | undefined) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const ParentDashboard = () => {
  const { user, setParentMode } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setParentMode(true);
  }, [setParentMode]);

  useEffect(() => {
    const loadChildren = async () => {
      if (!user) return;
      const { data } = await supabase.rpc("get_family_children");
      const list = ((data as any[]) || []).map((c) => ({
        user_id: c.user_id,
        student_name: c.student_name,
        grade: c.grade,
      }));
      setChildren(list);
      setSelectedChild(list.find((c) => c.user_id === user.id)?.user_id || list[0]?.user_id || user.id);
    };
    loadChildren();
  }, [user]);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedChild) return;
      setLoading(true);
      try {
        const [attRes, asgRes, quizRes, feeRes] = await Promise.all([
          supabase
            .from("attendance_records")
            .select("id, date, status, hours, topic")
            .eq("student_user_id", selectedChild)
            .is("deleted_at", null)
            .order("date", { ascending: false }),
          supabase
            .from("assignments")
            .select("id, title, subject, due_date, status, created_at")
            .eq("student_user_id", selectedChild)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("quiz_assignments")
            .select("id, quiz_id, max_attempts, quizzes(title, subject)")
            .eq("student_user_id", selectedChild)
            .is("deleted_at", null),
          supabase
            .from("student_fees")
            .select("id, month, total_hours, final_amount, total_amount, status, created_at")
            .eq("student_id", selectedChild)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
        ]);

        setAttendance((attRes.data || []) as AttendanceRecord[]);
        setAssignments((asgRes.data || []) as Assignment[]);
        setFees((feeRes.data || []) as FeeRow[]);

        const quizAssignments = (quizRes.data || []) as any[];
        let attemptsByAssignment = new Map<string, any[]>();
        if (quizAssignments.length) {
          const { data: attempts } = await supabase
            .from("quiz_attempts")
            .select("quiz_assignment_id, score, total, status, submitted_at")
            .in(
              "quiz_assignment_id",
              quizAssignments.map((q) => q.id)
            );
          for (const a of (attempts || []) as any[]) {
            const arr = attemptsByAssignment.get(a.quiz_assignment_id) || [];
            arr.push(a);
            attemptsByAssignment.set(a.quiz_assignment_id, arr);
          }
        }
        setQuizzes(
          quizAssignments.map((q) => ({
            ...q,
            attempts: attemptsByAssignment.get(q.id) || [],
          })) as QuizRow[]
        );
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedChild]);

  const child = children.find((c) => c.user_id === selectedChild);
  const isOwnChild = selectedChild === user?.id;

  const stats = useMemo(() => {
    const now = new Date();
    const monthRecords = attendance.filter((r) => {
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const present = monthRecords.filter((r) => r.status.toLowerCase() === "present").length;
    const pct = monthRecords.length ? Math.round((present / monthRecords.length) * 100) : 0;
    const pending = assignments.filter((a) => a.status === "pending").length;
    const quizzesDue = quizzes.filter((q) => !q.attempts.some((a) => a.status === "submitted")).length;
    const outstanding = fees
      .filter((f) => (f.status || "").toLowerCase() !== "paid")
      .reduce((s, f) => s + Number(f.final_amount ?? f.total_amount ?? 0), 0);
    return { pct, present, pending, quizzesDue, outstanding };
  }, [attendance, assignments, quizzes, fees]);

  const upcomingAssignment = useMemo(
    () =>
      assignments
        .filter((a) => a.status === "pending" && a.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())[0] || null,
    [assignments]
  );

  return (
    <DashboardLayout
      title={child ? `${child.student_name}'s progress` : "Parent Dashboard"}
      roleLabel="Parent"
      roleColor="parent"
      sidebarItems={parentSidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      <Seo title="Parent Dashboard — Shobs Academy" description="Follow your child's classes, assignments, quizzes and fees at Shobs Academy." path="/parent" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {children.length > 1 && (
            <Select value={selectedChild ?? undefined} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.student_name}
                    {c.grade ? ` · ${c.grade}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {child?.grade && <Badge variant="secondary">Grade {child.grade}</Badge>}
        </div>
        <Button variant="outline" asChild onClick={() => setParentMode(false)}>
          <Link to="/student">
            <Eye className="mr-2 h-4 w-4" />
            Open student dashboard
          </Link>
        </Button>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          {loading ? (
            <SkeletonStats />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Attendance this month" value={`${stats.pct}%`} icon={Calendar} variant="student" />
              <StatCard label="Classes attended" value={String(stats.present)} icon={CheckCircle2} variant="student" />
              <StatCard label="Pending assignments" value={String(stats.pending)} icon={FileText} variant="student" />
              <StatCard label="Quizzes to attempt" value={String(stats.quizzesDue)} icon={ListChecks} variant="student" />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="h-5 w-5" /> Next up
                </CardTitle>
                <CardDescription>Nearest deadline for {child?.student_name || "your child"}.</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingAssignment ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border p-4">
                    <div>
                      <p className="font-medium">{upcomingAssignment.title}</p>
                      <p className="text-sm text-muted-foreground">{upcomingAssignment.subject || "General"}</p>
                    </div>
                    <DueDateChip dueDate={upcomingAssignment.due_date} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing pending right now.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Receipt className="h-5 w-5" /> Fees outstanding
                </CardTitle>
                <CardDescription>Amounts not yet marked paid.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{formatINR(stats.outstanding)}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "schedule" &&
        (isOwnChild ? (
          <StudentCalendar />
        ) : (
          <EmptyState
            icon={Calendar}
            title="Schedule unavailable"
            description="Switch to this child's own login to view their calendar."
          />
        ))}

      {activeTab === "attendance" && <StudentAttendanceHistory attendance={attendance} />}

      {activeTab === "assignments" && (
        <Card>
          <CardHeader>
            <CardTitle>Assignments</CardTitle>
            <CardDescription>View only — submissions are made from the student dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <SkeletonList />}
            {!loading && assignments.length === 0 && (
              <EmptyState icon={FileText} title="No assignments" description="Nothing has been assigned yet." />
            )}
            {!loading &&
              assignments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.subject || "General"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.due_date && <DueDateChip dueDate={a.due_date} />}
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "quizzes" && (
        <Card>
          <CardHeader>
            <CardTitle>Quizzes</CardTitle>
            <CardDescription>Attempts and scores. View only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <SkeletonList />}
            {!loading && quizzes.length === 0 && (
              <EmptyState icon={ListChecks} title="No quizzes" description="No quizzes assigned yet." />
            )}
            {!loading &&
              quizzes.map((q) => {
                const submitted = q.attempts.filter((a) => a.status === "submitted");
                const best = submitted.reduce<number | null>(
                  (acc, a) => (a.score !== null && (acc === null || a.score > acc) ? a.score : acc),
                  null
                );
                const total = submitted[0]?.total ?? null;
                return (
                  <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                    <div>
                      <p className="font-medium">{q.quizzes?.title || "Quiz"}</p>
                      <p className="text-sm text-muted-foreground">
                        {q.quizzes?.subject || "General"} · {submitted.length} of {q.max_attempts ?? 1} attempts used
                      </p>
                    </div>
                    <Badge variant={submitted.length ? "default" : "secondary"}>
                      {submitted.length ? `Best: ${best ?? 0}${total ? ` / ${total}` : ""}` : "Not attempted"}
                    </Badge>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {activeTab === "materials" &&
        (isOwnChild ? (
          <div className="space-y-6">
            <StudentNotes />
            <StudentWhiteboards />
          </div>
        ) : (
          <EmptyState
            icon={FileText}
            title="Material unavailable"
            description="Switch to this child's own login to open their notes and whiteboards."
          />
        ))}

      {activeTab === "fees" && (
        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
            <CardDescription>Monthly fee records for {child?.student_name || "your child"}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <SkeletonList />}
            {!loading && fees.length === 0 && (
              <EmptyState icon={Receipt} title="No fee records" description="Nothing has been billed yet." />
            )}
            {!loading &&
              fees.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <p className="font-medium">{f.month}</p>
                    <p className="text-sm text-muted-foreground">{Number(f.total_hours || 0)} hours</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{formatINR(f.final_amount ?? f.total_amount)}</span>
                    <StatusBadge status={f.status || "pending"} />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {activeTab === "messages" && <ParentAdminMessaging userRole="parent" />}
    </DashboardLayout>
  );
};

export default ParentDashboard;
