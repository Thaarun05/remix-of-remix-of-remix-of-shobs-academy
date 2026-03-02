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
    const dueDate = format(endOfMonth(new Date()), "MMM d, yyyy");

    // Fetch attendance for this fee record if not already loaded
    let attendanceData = attendance;
    if (fee) {
      try {
        // Parse month from "January 2026" format
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

    const attendanceTableHTML = attendanceData.length > 0 ? `
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Status</th><th>Hours</th><th>Topic</th></tr></thead>
          <tbody>
            ${attendanceData.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${format(new Date(r.date), "MMM d, yyyy")}</td>
                <td class="${r.status.toLowerCase()}">${r.status}</td>
                <td>${r.hours ?? "-"}</td>
                <td>${r.topic || "-"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div style="margin-bottom:8px; font-size:13px; color:#555;">
          <strong>Present:</strong> ${attendanceData.filter(a => a.status.toLowerCase() === "present").length} days &nbsp;|&nbsp;
          <strong>Absent:</strong> ${attendanceData.filter(a => a.status.toLowerCase() === "absent").length} days &nbsp;|&nbsp;
          <strong>Total Present Hours:</strong> ${attendanceData.filter(a => a.status.toLowerCase() === "present").reduce((s, a) => s + (Number(a.hours) || 0), 0)} hrs
        </div>
    ` : `<p style="color:#999; text-align:center; padding:16px;">No attendance records available.</p>`;

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${studentName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #6c63ff; padding-bottom: 20px; }
          .header h1 { font-size: 28px; color: #6c63ff; margin-bottom: 4px; }
          .header p { color: #666; font-size: 14px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 14px; }
          .meta div { line-height: 1.8; }
          .meta strong { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #6c63ff; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
          td { padding: 9px 14px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
          tr:nth-child(even) { background: #f8f8ff; }
          .present { color: #16a34a; font-weight: 600; }
          .absent { color: #dc2626; font-weight: 600; }
          .summary { background: #f0efff; border-radius: 8px; padding: 20px; margin-top: 8px; }
          .summary h3 { color: #6c63ff; margin-bottom: 12px; font-size: 16px; }
          .summary .line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
          .summary .total { border-top: 2px solid #6c63ff; margin-top: 10px; padding-top: 10px; font-size: 20px; font-weight: 700; color: #6c63ff; }
          .payment { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 16px; }
          .payment h4 { color: #b45309; margin-bottom: 8px; }
          .payment p { font-size: 13px; color: #92400e; line-height: 1.6; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Shobs Academy</h1>
          <p>Student Fee Invoice</p>
        </div>
        <div class="meta">
          <div>
            <strong>Student:</strong> ${studentName}<br/>
            <strong>Month:</strong> ${month}
          </div>
          <div style="text-align:right">
            <strong>Date:</strong> ${format(new Date(), "MMM d, yyyy")}<br/>
            <strong>Due Date:</strong> ${dueDate}<br/>
            <strong>Invoice #:</strong> INV-${Date.now().toString(36).toUpperCase()}
          </div>
        </div>
        <h3 style="font-size:15px; color:#333; margin-bottom:12px;">Attendance Record</h3>
        ${attendanceTableHTML}
        <div class="summary">
          <h3>Fee Summary</h3>
          <div class="line"><span>Total Present Hours</span><span>${hours} hrs</span></div>
          <div class="line"><span>Hourly Rate</span><span>₹${new Intl.NumberFormat("en-IN").format(feeRate)}</span></div>
          <div class="line total"><span>Total Fee</span><span>${formatINR(total)}</span></div>
        </div>
        <div class="payment">
          <h4>Payment Instructions</h4>
          <p>Please ensure payment is made by <strong>${dueDate}</strong>.<br/>
          For queries, contact Shobs Academy administration.</p>
        </div>
        <div class="footer">
          Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")} • Shobs Academy
        </div>
      </body>
      </html>
    `;

    try {
      const { default: html2pdf } = await import("html2pdf.js");
      
      // Create a temporary hidden container
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0";
      wrapper.innerHTML = `
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, div { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #6c63ff; padding-bottom: 20px; }
          .header h1 { font-size: 28px; color: #6c63ff; margin-bottom: 4px; }
          .header p { color: #666; font-size: 14px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 14px; }
          .meta div { line-height: 1.8; }
          .meta strong { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #6c63ff; color: white; padding: 10px 14px; text-align: left; font-size: 13px; }
          td { padding: 9px 14px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
          tr:nth-child(even) { background: #f8f8ff; }
          .present { color: #16a34a; font-weight: 600; }
          .absent { color: #dc2626; font-weight: 600; }
          .summary { background: #f0efff; border-radius: 8px; padding: 20px; margin-top: 8px; }
          .summary h3 { color: #6c63ff; margin-bottom: 12px; font-size: 16px; }
          .summary .line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 14px; }
          .summary .total { border-top: 2px solid #6c63ff; margin-top: 10px; padding-top: 10px; font-size: 20px; font-weight: 700; color: #6c63ff; }
          .payment { background: #fffbeb; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 16px; }
          .payment h4 { color: #b45309; margin-bottom: 8px; }
          .payment p { font-size: 13px; color: #92400e; line-height: 1.6; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
        </style>
        <div style="padding:40px;">
          <div class="header">
            <h1>Shobs Academy</h1>
            <p>Student Fee Invoice</p>
          </div>
          <div class="meta">
            <div>
              <strong>Student:</strong> ${studentName}<br/>
              <strong>Month:</strong> ${month}
            </div>
            <div style="text-align:right">
              <strong>Date:</strong> ${format(new Date(), "MMM d, yyyy")}<br/>
              <strong>Due Date:</strong> ${dueDate}<br/>
              <strong>Invoice #:</strong> INV-${Date.now().toString(36).toUpperCase()}
            </div>
          </div>
          <h3 style="font-size:15px; color:#333; margin-bottom:12px;">Attendance Record</h3>
          ${attendanceTableHTML}
          <div class="summary">
            <h3>Fee Summary</h3>
            <div class="line"><span>Total Present Hours</span><span>${hours} hrs</span></div>
            <div class="line"><span>Hourly Rate</span><span>₹${new Intl.NumberFormat("en-IN").format(feeRate)}</span></div>
            <div class="line total"><span>Total Fee</span><span>${formatINR(total)}</span></div>
          </div>
          <div class="payment">
            <h4>Payment Instructions</h4>
            <p>Please ensure payment is made by <strong>${dueDate}</strong>.<br/>
            For queries, contact Shobs Academy administration.</p>
          </div>
          <div class="footer">
            Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")} • Shobs Academy
          </div>
        </div>
      `;
      document.body.appendChild(wrapper);

      await html2pdf()
        .set({
          margin: 0.3,
          filename: `Invoice_${studentName}_${month.replace(/\s/g, "_")}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        })
        .from(wrapper)
        .save();

      document.body.removeChild(wrapper);
    } catch (err) {
      console.error("html2pdf failed, falling back to print:", err);
      // Fallback: open in new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 300);
      }
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
