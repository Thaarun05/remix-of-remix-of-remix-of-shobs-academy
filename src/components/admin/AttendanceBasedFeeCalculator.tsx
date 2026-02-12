import { useState, useEffect, useRef } from "react";
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
import { Loader2, Calculator, IndianRupee, RotateCcw, Save, Download } from "lucide-react";
import { format, endOfMonth } from "date-fns";

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

export const AttendanceBasedFeeCalculator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const invoiceRef = useRef<HTMLDivElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [hourlyRate, setHourlyRate] = useState("");
  const [calculated, setCalculated] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selectedStudentId && selectedMonth) {
      fetchAttendance();
      setCalculated(false);
    } else {
      setAttendance([]);
      setCalculated(false);
    }
  }, [selectedStudentId, selectedMonth]);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from("student_profiles")
      .select("user_id, student_name")
      .order("student_name");
    setStudents(data || []);
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

  const handleCalculate = () => {
    if (!selectedStudentId || !selectedMonth) {
      toast({ title: "Select both month and student", variant: "destructive" });
      return;
    }
    if (rate <= 0) {
      toast({ title: "Enter a valid hourly rate greater than 0", variant: "destructive" });
      return;
    }
    setCalculated(true);
  };

  const handleSave = async () => {
    if (!calculated || !selectedStudent) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("student_fees").insert({
        student_id: selectedStudentId,
        teacher_id: user!.id,
        month: `${selectedMonth} ${currentYear}`,
        total_hours: totalPresentHours,
        fee_per_hour: rate,
        total_amount: totalFee,
        student_name: selectedStudent.student_name,
        status: "sent_to_admin",
      });
      if (error) throw error;

      toast({ title: "Fee record saved!", description: `${formatINR(totalFee)} for ${selectedStudent.student_name}` });
    } catch (error: any) {
      toast({ title: "Error saving fee", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPDF = () => {
    const studentName = selectedStudent?.student_name || "Student";
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
            <strong>Month:</strong> ${selectedMonth} ${currentYear}
          </div>
          <div style="text-align:right">
            <strong>Date:</strong> ${format(new Date(), "MMM d, yyyy")}<br/>
            <strong>Invoice #:</strong> INV-${Date.now().toString(36).toUpperCase()}
          </div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Status</th><th>Hours</th><th>Topic</th></tr></thead>
          <tbody>
            ${attendance.map((r, i) => `
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
        <div class="summary">
          <h3>Fee Summary</h3>
          <div class="line"><span>Total Present Days</span><span>${presentCount}</span></div>
          <div class="line"><span>Total Absent Days</span><span>${absentCount}</span></div>
          <div class="line"><span>Total Present Hours</span><span>${totalPresentHours} hrs</span></div>
          <div class="line"><span>Hourly Rate</span><span>₹${new Intl.NumberFormat("en-IN").format(rate)}</span></div>
          <div class="line total"><span>Total Fee</span><span>${formatINR(totalFee)}</span></div>
        </div>
        <div class="footer">
          Generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")} • Shobs Academy
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  const handleClear = () => {
    setSelectedStudentId("");
    setSelectedMonth("");
    setAttendance([]);
    setHourlyRate("");
    setCalculated(false);
  };

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-primary" />
          Attendance-Based Fee Calculator
        </CardTitle>
        <CardDescription>
          Select a month and student to view attendance and calculate fees in INR
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

                <Button onClick={handleCalculate} disabled={!hourlyRate || rate <= 0}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Total Fee
                </Button>

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
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Fee Record
                      </Button>
                      <Button variant="outline" onClick={handleExportPDF}>
                        <Download className="h-4 w-4 mr-2" />
                        Export Invoice PDF
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
  );
};
