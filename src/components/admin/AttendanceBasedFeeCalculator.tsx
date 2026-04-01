import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Calculator, IndianRupee, RotateCcw, Save, Download, Send,
  Edit2, Trash2, FileText, Clock
} from "lucide-react";
import { format, endOfMonth } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Student {
  user_id: string;
  student_name: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
}

interface FeeRecord {
  id: string;
  student_id: string;
  student_name: string | null;
  month: string;
  total_hours: number | null;
  fee_per_hour: number | null;
  total_amount: number | null;
  status: string | null;
  created_at: string | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatINR = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const getStatusBadge = (status: string | null) => {
  switch (status) {
    case "draft": return <Badge variant="outline" className="bg-muted/50"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
    case "sent_to_student": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
    case "paid": return <Badge className="bg-success/10 text-success border-success/20">Paid</Badge>;
    case "overdue": return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export const AttendanceBasedFeeCalculator = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("");
  const [calculated, setCalculated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

  // Fee records list
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);
  const [showDraftsOnly, setShowDraftsOnly] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Send confirmation dialog
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchStudents();
    fetchFeeRecords();
  }, []);

  useEffect(() => {
    if (selectedStudentId && selectedMonth) {
      fetchAttendance();
      setCalculated(false);
      setDraftSavedAt(null);
    } else {
      setAttendance([]);
      setCalculated(false);
      setDraftSavedAt(null);
    }
  }, [selectedStudentId, selectedMonth]);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("student_profiles")
      .select("user_id, student_name")
      .order("student_name");
    setStudents(data || []);
  };

  const fetchFeeRecords = async () => {
    const { data } = await supabase
      .from("student_fees")
      .select("id, student_id, student_name, month, total_hours, fee_per_hour, total_amount, status, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    setFeeRecords((data as FeeRecord[]) || []);
  };

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const monthIndex = MONTHS.indexOf(selectedMonth);
      const startDate = format(new Date(currentYear, monthIndex, 1), "yyyy-MM-dd");
      const endDate = format(endOfMonth(new Date(currentYear, monthIndex, 1)), "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, date, status, hours, topic")
        .eq("student_user_id", selectedStudentId)
        .is("deleted_at", null)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      if (error) throw error;
      setAttendance(data || []);
    } catch (error: any) {
      toast({ title: "Error fetching attendance", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalPresentHours = attendance
    .filter((a) => a.status.toLowerCase() === "present")
    .reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
  const presentCount = attendance.filter((a) => a.status.toLowerCase() === "present").length;
  const absentCount = attendance.filter((a) => a.status.toLowerCase() === "absent").length;
  const rate = parseFloat(hourlyRate) || 0;
  const totalFee = totalPresentHours * rate;
  const selectedStudent = students.find((s) => s.user_id === selectedStudentId);

  const handleCalculate = async () => {
    if (!selectedStudentId || !selectedMonth) {
      toast({ title: "Select both month and student", variant: "destructive" });
      return;
    }
    if (rate <= 0) {
      toast({ title: "Enter a valid hourly rate greater than 0", variant: "destructive" });
      return;
    }
    setCalculated(true);

    // Auto-save as draft
    await saveFeeRecord("draft");
  };

  const saveFeeRecord = async (status: string) => {
    if (!selectedStudent) return;
    const isSaving = status === "draft";
    isSaving ? setSaving(true) : setSending(true);

    try {
      const feeData = {
        student_id: selectedStudentId,
        teacher_id: user!.id,
        month: `${selectedMonth} ${currentYear}`,
        total_hours: totalPresentHours,
        fee_per_hour: rate,
        total_amount: totalFee,
        student_name: selectedStudent.student_name,
        status,
      };

      if (editingFeeId) {
        const { error } = await supabase
          .from("student_fees")
          .update(feeData)
          .eq("id", editingFeeId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("student_fees")
          .insert(feeData)
          .select("id")
          .single();
        if (error) throw error;
        setEditingFeeId(data.id);
      }

      if (status === "draft") {
        setDraftSavedAt(format(new Date(), "h:mm a"));
        toast({ title: "Draft saved", description: `Auto-saved at ${format(new Date(), "h:mm a")}` });
      } else if (status === "sent_to_student") {
        // Send notification
        await supabase.from("notifications").insert({
          recipient_id: selectedStudentId,
          sender_id: user!.id,
          type: "fee",
          title: "Fee Sheet Available",
          body: `Your fee sheet for ${selectedMonth} ${currentYear} is ready. Total: ${formatINR(totalFee)}`,
          entity_table: "student_fees",
          entity_id: editingFeeId,
        });
        toast({ title: "Sent to student!", description: `Fee sheet sent to ${selectedStudent.student_name}` });
        handleClear();
      }

      fetchFeeRecords();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const handleSendToStudent = () => {
    setSendDialogOpen(true);
  };

  const confirmSend = async () => {
    setSendDialogOpen(false);
    await saveFeeRecord("sent_to_student");
  };

  const handleDeleteFee = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("student_fees")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Fee record deleted" });
      setDeleteDialogOpen(false);
      setDeletingId(null);
      if (editingFeeId === id) handleClear();
      fetchFeeRecords();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const loadFeeForEdit = (fee: FeeRecord) => {
    setEditingFeeId(fee.id);
    setSelectedStudentId(fee.student_id);
    // Parse month from "January 2026" format
    const parts = fee.month.split(" ");
    if (parts.length >= 1) setSelectedMonth(parts[0]);
    setHourlyRate(fee.fee_per_hour?.toString() || "");
    setCalculated(true);
    setDraftSavedAt(null);
    toast({ title: "Loaded for editing", description: fee.student_name || "" });
  };

  const handleExportPDF = async (fee?: FeeRecord) => {
    const studentName = fee?.student_name || selectedStudent?.student_name || "Student";
    const month = fee ? fee.month : `${selectedMonth} ${currentYear}`;
    const hours = fee?.total_hours ?? totalPresentHours;
    const feeRate = fee?.fee_per_hour ?? rate;
    const total = fee?.total_amount ?? totalFee;

    // Fetch attendance for this fee record if not already loaded
    let attendanceData = attendance;
    if (fee) {
      try {
        const parts = fee.month.split(" ");
        const monthName = parts[0];
        const year = parseInt(parts[1]) || currentYear;
        const monthIndex = MONTHS.indexOf(monthName);
        if (monthIndex >= 0) {
          const startDate = format(new Date(year, monthIndex, 1), "yyyy-MM-dd");
          const endDate = format(endOfMonth(new Date(year, monthIndex, 1)), "yyyy-MM-dd");
          const { data } = await supabase
            .from("attendance_records")
            .select("id, date, status, hours, topic")
            .eq("student_user_id", fee.student_id)
            .is("deleted_at", null)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date");
          attendanceData = data || [];
        }
      } catch (e) {
        console.error("Failed to fetch attendance for PDF", e);
      }
    }

    try {
      const { generateFeePdf } = await import("@/lib/generateFeePdf");
      generateFeePdf({
        invoiceId: fee?.id ?? editingFeeId ?? undefined,
        studentName,
        month,
        totalHours: hours,
        feePerHour: feeRate,
        totalAmount: total,
        attendance: attendanceData,
        createdAt: fee?.created_at ?? undefined,
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast({ title: "PDF export failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleClear = () => {
    setSelectedStudentId("");
    setSelectedMonth("");
    setAttendance([]);
    setHourlyRate("");
    setCalculated(false);
    setEditingFeeId(null);
    setDraftSavedAt(null);
  };

  const filteredRecords = showDraftsOnly
    ? feeRecords.filter((r) => r.status === "draft")
    : feeRecords;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Calculator */}
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-primary" />
            Fee Calculator
            {editingFeeId && <Badge variant="outline" className="ml-2">Editing</Badge>}
          </CardTitle>
          <CardDescription>
            Select month & student → View attendance → Calculate & send fee
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Select Month <span className="text-destructive">*</span></Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select Student <span className="text-destructive">*</span></Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading attendance...</span>
            </div>
          )}

          {/* Attendance Table */}
          {!loading && selectedStudentId && selectedMonth && (
            <>
              {attendance.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 border rounded-lg bg-muted/20">
                  No attendance records found for {selectedMonth}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Topic</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{format(new Date(record.date), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                record.status.toLowerCase() === "present"
                                  ? "bg-success/10 text-success border-success/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }
                            >
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.hours ?? "-"}</TableCell>
                          <TableCell className="truncate max-w-[200px]">{record.topic || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-primary/5 font-medium">
                        <TableCell>Summary</TableCell>
                        <TableCell>
                          <span className="text-success">{presentCount} Present</span>
                          {absentCount > 0 && <span className="text-destructive ml-2">· {absentCount} Absent</span>}
                        </TableCell>
                        <TableCell className="font-bold text-primary">{totalPresentHours} hrs</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}

              {/* Hourly Rate + Calculate */}
              {attendance.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="max-w-xs">
                    <Label>Hourly Rate (₹) <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₹</span>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={hourlyRate}
                        onChange={(e) => { setHourlyRate(e.target.value); setCalculated(false); }}
                        placeholder="e.g. 500"
                        className="pl-8"
                      />
                    </div>
                  </div>

                  <Button onClick={handleCalculate} disabled={!hourlyRate || rate <= 0 || saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Calculator className="h-4 w-4 mr-2" />}
                    Calculate Total Fee
                  </Button>

                  {/* Draft saved indicator */}
                  {draftSavedAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Draft saved at {draftSavedAt}
                    </div>
                  )}

                  {/* Result */}
                  {calculated && (
                    <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-5 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {totalPresentHours} hrs × {formatINR(rate)}/hr
                      </p>
                      <p className="text-2xl font-bold text-primary flex items-center gap-2">
                        <IndianRupee className="h-6 w-6" />
                        Total Fee: {formatINR(totalFee)}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          onClick={handleSendToStudent}
                          disabled={sending}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          Send to Student
                        </Button>
                        <Button variant="outline" onClick={() => saveFeeRecord("draft")} disabled={saving}>
                          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save Draft
                        </Button>
                        <Button variant="outline" onClick={() => handleExportPDF()}>
                          <Download className="h-4 w-4 mr-2" />
                          Export PDF
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Clear Button */}
          {(selectedStudentId || selectedMonth || hourlyRate) && (
            <Button variant="outline" onClick={handleClear} className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Right: Fee Records List */}
      <Card className="dashboard-list-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fee Records</CardTitle>
              <CardDescription>View and manage fee records</CardDescription>
            </div>
            <Button
              variant={showDraftsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDraftsOnly(!showDraftsOnly)}
            >
              <FileText className="h-4 w-4 mr-1" />
              {showDraftsOnly ? "Show All" : "Drafts Only"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {showDraftsOnly ? "No drafts found" : "No fee records yet"}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map((fee) => (
                <div key={fee.id} className="p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{fee.student_name}</span>
                        {getStatusBadge(fee.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {fee.month} • {fee.total_hours} hrs × {formatINR(fee.fee_per_hour || 0)}/hr
                      </p>
                      <p className="text-lg font-bold text-primary mt-1">
                        {formatINR(fee.total_amount || 0)}
                      </p>
                      {fee.created_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Created: {format(new Date(fee.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {fee.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => loadFeeForEdit(fee)}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleExportPDF(fee)}>
                        <Download className="h-3.5 w-3.5 mr-1" />PDF
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { setDeletingId(fee.id); setDeleteDialogOpen(true); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Fee Sheet to Student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the fee sheet ({formatINR(totalFee)}) to {selectedStudent?.student_name} and notify them.
              The status will change from Draft to Sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSend} className="bg-emerald-600 hover:bg-emerald-700">
              Send to Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fee Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this fee record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDeleteFee(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
