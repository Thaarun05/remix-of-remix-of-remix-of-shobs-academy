import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { EmptyState } from "@/components/EmptyState";
import { FileSpreadsheet, Loader2, DollarSign, IndianRupee, Download } from "lucide-react";
import { format, endOfMonth } from "date-fns";

interface FeeRecord {
  id: string;
  student_id: string;
  student_name: string | null;
  month: string;
  total_hours: number | null;
  fee_per_hour: number | null;
  total_amount: number | null;
  status: string | null;
  student_ack_status: string | null;
  created_at: string | null;
  teacher_name: string | null;
  base_amount?: number | null;
  sibling_discount_pct?: number | null;
  sibling_discount_amount?: number | null;
  final_amount?: number | null;
  sibling_rank?: number | null;
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

export const StudentFeeSheet = () => {
  const { user } = useAuth();
  

  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [selectedFee, setSelectedFee] = useState<FeeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  useEffect(() => {
    if (user) fetchFees();
  }, [user]);

  const fetchFees = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_fees")
      .select("*")
      .eq("student_id", user!.id)
      .eq("status", "sent_to_student")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const records = (data as FeeRecord[]) || [];
    setFees(records);

    // Auto-select the first one without ack
    const pending = records.find(f => !f.student_ack_status);
    const autoSelect = pending || records[0];
    if (autoSelect) {
      setSelectedFee(autoSelect);
      fetchAttendance(autoSelect);
    }

    setLoading(false);
  };

  const fetchAttendance = async (fee: FeeRecord) => {
    setLoadingAttendance(true);
    try {
      const parts = fee.month.split(" ");
      const monthName = parts[0];
      const year = parseInt(parts[1]) || new Date().getFullYear();
      const monthIndex = MONTHS.indexOf(monthName);
      if (monthIndex < 0) return;
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
      setAttendanceRecords(data || []);
    } catch {
      setAttendanceRecords([]);
    } finally {
      setLoadingAttendance(false);
    }
  };


  const getAckBadge = (ack: string | null) => {
    switch (ack) {
      case "correct": return <Badge className="bg-success/10 text-success border-success/20">Confirmed</Badge>;
      case "correction_needed": return <Badge className="bg-warning/10 text-warning border-warning/20">Correction Requested</Badge>;
      default: return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Sent</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-student" />
      </div>
    );
  }

  if (fees.length === 0) {
    return (
      <EmptyState
        icon={DollarSign}
        title="No fee sheets yet"
        description="When the admin sends you a fee sheet, it will appear here for your review."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Fee List */}
      {fees.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Fee Sheets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {fees.map((fee) => (
                <Button
                  key={fee.id}
                  variant={selectedFee?.id === fee.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setSelectedFee(fee); fetchAttendance(fee); }}
                >
                  {fee.month}
                  <span className="ml-2">{getAckBadge(fee.student_ack_status)}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Fee Details */}
      {selectedFee && (
        <Card className="dashboard-list-card">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-student" />
                  Fee Sheet — {selectedFee.month}
                </CardTitle>
                <CardDescription>
                  {selectedFee.created_at && `Created on ${format(new Date(selectedFee.created_at), "MMMM d, yyyy")}`}
                  {selectedFee.teacher_name && ` • Teacher: ${selectedFee.teacher_name}`}
                </CardDescription>
              </div>
              {getAckBadge(selectedFee.student_ack_status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fee Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{selectedFee.total_hours ?? 0} hrs</p>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <p className="text-sm text-muted-foreground">Hourly Rate</p>
                <p className="text-2xl font-bold flex items-center justify-center gap-1">
                  <IndianRupee className="h-5 w-5" />
                  {selectedFee.fee_per_hour ? new Intl.NumberFormat("en-IN").format(selectedFee.fee_per_hour) : "0"}
                </p>
              </div>
              <div className="p-4 bg-primary/10 rounded-lg text-center border border-primary/20">
                <p className="text-sm text-muted-foreground">Total Fee</p>
                <p className="text-2xl font-bold text-primary">
                  {selectedFee.total_amount ? formatINR(selectedFee.total_amount) : "₹0"}
                </p>
              </div>
            </div>

            {/* Attendance Breakdown */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Attendance Breakdown</h3>
              {loadingAttendance ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading attendance...</span>
                </div>
              ) : attendanceRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No attendance records found for this month.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Hours</TableHead>
                        <TableHead className="text-xs">Topic</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((r, i) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="text-xs">{format(new Date(r.date), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={r.status.toLowerCase() === "present" ? "bg-success/10 text-success border-success/20 text-xs" : "bg-destructive/10 text-destructive border-destructive/20 text-xs"}>
                              {r.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{r.hours ?? "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.topic || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground flex justify-between">
                    <span>Present: {attendanceRecords.filter(a => a.status.toLowerCase() === "present").length} days</span>
                    <span>Absent: {attendanceRecords.filter(a => a.status.toLowerCase() === "absent").length} days</span>
                    <span>Total Present Hours: {attendanceRecords.filter(a => a.status.toLowerCase() === "present").reduce((s, a) => s + (Number(a.hours) || 0), 0)} hrs</span>
                  </div>
                </div>
              )}
            </div>

            {/* Breakdown */}
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground text-center">
              {selectedFee.total_hours ?? 0} hours × {formatINR(selectedFee.fee_per_hour ?? 0)}/hr = <span className="font-semibold text-foreground">{formatINR(selectedFee.total_amount ?? 0)}</span>
            </div>

            {/* Download PDF */}
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={async () => {
                  const { generateFeePdf } = await import("@/lib/generateFeePdf");
                  generateFeePdf({
                    invoiceId: selectedFee.id,
                    studentName: selectedFee.student_name || "Student",
                    month: selectedFee.month,
                    totalHours: selectedFee.total_hours ?? 0,
                    feePerHour: selectedFee.fee_per_hour ?? 0,
                    totalAmount: selectedFee.total_amount ?? 0,
                    attendance: attendanceRecords,
                    teacherName: selectedFee.teacher_name || undefined,
                    createdAt: selectedFee.created_at || undefined,
                  });
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download PDF Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
