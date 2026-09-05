import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Wallet, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface Teacher {
  user_id: string;
  full_name: string;
}

interface StudentRow {
  student_user_id: string;
  student_name: string;
  fee_given: string;
  dirty: boolean;
  saving: boolean;
}

const formatInr = (value: string) => {
  const n = parseFloat(value);
  if (isNaN(n)) return "—";
  return `Rs. ${n.toFixed(2)}`;
};

export function StudentFeeSettings() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    const loadTeachers = async () => {
      setLoadingTeachers(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("role", "teacher")
        .order("full_name");
      if (error) {
        toast.error("Failed to load teachers");
      } else {
        setTeachers((data ?? []).map((t) => ({ user_id: t.user_id, full_name: t.full_name || "Unnamed Teacher" })));
      }
      setLoadingTeachers(false);
    };
    loadTeachers();
  }, []);

  const loadStudents = useCallback(async (teacherId: string) => {
    setLoadingStudents(true);

    // Source 1: student_teacher_assignments
    const { data: assignments, error: assignError } = await supabase
      .from("student_teacher_assignments")
      .select("student_user_id")
      .eq("teacher_user_id", teacherId);

    // Source 2: legacy assigned_teacher_id on student_profiles
    const { data: legacyProfiles, error: legacyError } = await supabase
      .from("student_profiles")
      .select("user_id, student_name")
      .eq("assigned_teacher_id", teacherId);

    if (assignError || legacyError) {
      toast.error("Failed to load students");
      setLoadingStudents(false);
      return;
    }

    const studentIds = new Set<string>();
    (assignments ?? []).forEach((a) => studentIds.add(a.student_user_id));
    (legacyProfiles ?? []).forEach((p) => studentIds.add(p.user_id));

    if (studentIds.size === 0) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    const ids = Array.from(studentIds);

    const [{ data: nameRows, error: namesError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from("student_profiles").select("user_id, student_name").in("user_id", ids),
      supabase.from("student_fee_settings").select("student_user_id, fee_given").eq("teacher_user_id", teacherId).in("student_user_id", ids),
    ]);

    if (namesError || settingsError) {
      toast.error("Failed to load fee settings");
      setLoadingStudents(false);
      return;
    }

    const nameMap = new Map<string, string>();
    (nameRows ?? []).forEach((r) => nameMap.set(r.user_id, r.student_name));

    const settingsMap = new Map<string, { fee_given: number | null }>();
    (settings ?? []).forEach((s) => settingsMap.set(s.student_user_id, { fee_given: s.fee_given }));

    const rows: StudentRow[] = ids
      .map((id) => {
        const s = settingsMap.get(id);
        return {
          student_user_id: id,
          student_name: nameMap.get(id) || "Unnamed Student",
          fee_given: s?.fee_given != null ? String(s.fee_given) : "",
          dirty: false,
          saving: false,
        };
      })
      .sort((a, b) => a.student_name.localeCompare(b.student_name));

    setStudents(rows);
    setLoadingStudents(false);
  }, []);

  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacher(teacherId);
    loadStudents(teacherId);
  };

  const updateRow = (studentId: string, field: "fee_collected" | "fee_given", value: string) => {
    setStudents((prev) =>
      prev.map((r) => (r.student_user_id === studentId ? { ...r, [field]: value, dirty: true } : r)),
    );
  };

  const saveRow = async (row: StudentRow) => {
    setStudents((prev) =>
      prev.map((r) => (r.student_user_id === row.student_user_id ? { ...r, saving: true } : r)),
    );

    const feeCollected = row.fee_collected.trim() === "" ? null : parseFloat(row.fee_collected);
    const feeGiven = row.fee_given.trim() === "" ? null : parseFloat(row.fee_given);

    if ((row.fee_collected.trim() !== "" && isNaN(feeCollected as number)) || (row.fee_given.trim() !== "" && isNaN(feeGiven as number))) {
      toast.error("Please enter valid numbers for the fee amounts");
      setStudents((prev) =>
        prev.map((r) => (r.student_user_id === row.student_user_id ? { ...r, saving: false } : r)),
      );
      return;
    }

    const { error } = await supabase
      .from("student_fee_settings")
      .upsert(
        {
          student_user_id: row.student_user_id,
          teacher_user_id: selectedTeacher,
          fee_collected: feeCollected,
          fee_given: feeGiven,
        },
        { onConflict: "student_user_id,teacher_user_id" },
      );

    if (error) {
      toast.error(`Failed to save fee settings for ${row.student_name}`);
    } else {
      toast.success(`Saved fee settings for ${row.student_name}`);
    }

    setStudents((prev) =>
      prev.map((r) =>
        r.student_user_id === row.student_user_id ? { ...r, saving: false, dirty: error ? r.dirty : false } : r,
      ),
    );
  };

  const teacherName = teachers.find((t) => t.user_id === selectedTeacher)?.full_name;

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Student Fee Settings
        </CardTitle>
        <CardDescription>
          Select a teacher to set the fee collected from parents and the fee given to the teacher for each of their students.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 max-w-sm">
          <Label>Teacher</Label>
          <Select value={selectedTeacher} onValueChange={handleTeacherChange} disabled={loadingTeachers}>
            <SelectTrigger>
              <SelectValue placeholder={loadingTeachers ? "Loading teachers..." : "Select a teacher"} />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.user_id} value={t.user_id}>
                  {t.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTeacher && (
          loadingStudents ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading students...
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No students are assigned to {teacherName ?? "this teacher"} yet.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="hidden md:grid md:grid-cols-[1fr_180px_180px_110px] gap-3 px-3 text-xs font-medium text-muted-foreground">
                <span>Student</span>
                <span>Fee Collected (from parent)</span>
                <span>Fee Given (to teacher)</span>
                <span />
              </div>
              {students.map((row) => (
                <div
                  key={row.student_user_id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_180px_180px_110px] gap-3 items-center p-3 rounded-lg border border-border"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{row.student_name}</p>
                    {(row.fee_collected || row.fee_given) && (
                      <p className="text-xs text-muted-foreground">
                        Collected: {formatInr(row.fee_collected)} • Given: {formatInr(row.fee_given)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden text-xs">Fee Collected (from parent)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g., 5000"
                      value={row.fee_collected}
                      onChange={(e) => updateRow(row.student_user_id, "fee_collected", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden text-xs">Fee Given (to teacher)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g., 3500"
                      value={row.fee_given}
                      onChange={(e) => updateRow(row.student_user_id, "fee_given", e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="dashboard-btn"
                    disabled={!row.dirty || row.saving}
                    onClick={() => saveRow(row)}
                  >
                    {row.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" />Save</>}
                  </Button>
                </div>
              ))}
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
