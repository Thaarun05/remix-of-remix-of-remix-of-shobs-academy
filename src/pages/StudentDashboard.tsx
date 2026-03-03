import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileDownload } from "@/components/FileDownload";
import { EmptyState } from "@/components/EmptyState";
import { StudentCalendar } from "@/components/StudentCalendar";
import { MessagingPanel } from "@/components/messaging/MessagingPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { studentSidebarItems } from "@/components/dashboard/DashboardSidebar";
import { StudentFeeSheet } from "@/components/student/StudentFeeSheet";
import { StudentAttendanceHistory } from "@/components/student/StudentAttendanceHistory";
import { StudentNotes } from "@/components/student/StudentNotes";
import { 
  Calendar, 
  Video, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Loader2,
  Upload,
  X,
  File,
  CalendarDays,
  MessageSquare,
  GraduationCap,
  BookOpen,
  DollarSign,
  AlertTriangle,
  Eye
} from "lucide-react";
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

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
}

interface FileInfo {
  file_name: string;
  storage_path: string;
  uploaded_by_role: "teacher" | "student";
  uploaded_at: string;
}

interface Assignment {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  has_attachments: boolean;
  attachments: FileInfo[];
  submission_attachments: FileInfo[];
}

interface ZoomLink {
  meeting_url: string;
  meeting_id: string | null;
  passcode: string | null;
}

interface StudentFee {
  id: string;
  created_at: string;
  month: string;
  student_name: string | null;
  teacher_name: string | null;
  total_hours: number | null;
  fee_per_hour: number | null;
  total_amount: number | null;
  class_dates: string | null;
  subjects: string | null;
  status: string | null;
  student_ack_status: string | null;
}

const StudentDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [zoomLink, setZoomLink] = useState<ZoomLink | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [activeTab, setActiveTab] = useState("schedule");
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [selectedFee, setSelectedFee] = useState<StudentFee | null>(null);

  // File upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ [key: string]: File[] }>({});
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [attendanceRes, assignmentsRes, zoomRes, feesRes] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("id, date, status, hours, topic")
          .eq("student_user_id", user.id)
          .order("date", { ascending: false }),
        supabase
          .from("assignments")
          .select("id, title, subject, description, due_date, status, created_at, has_attachments, attachments, submission_attachments")
          .eq("student_user_id", user.id)
          
          .is("deleted_at", null)
          .order("due_date", { ascending: true }),
        supabase
          .from("zoom_links")
          .select("meeting_url, meeting_id, passcode")
          .eq("student_user_id", user.id)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("student_fees")
          .select("*")
          .eq("student_id", user.id)
          .eq("status", "sent_to_student")
          .order("created_at", { ascending: false })
      ]);

      setAttendance(attendanceRes.data || []);
      setAssignments((assignmentsRes.data || []).map(a => ({
        ...a,
        attachments: (a.attachments as unknown as FileInfo[]) || [],
        submission_attachments: (a.submission_attachments as unknown as FileInfo[]) || [],
      })));
      setZoomLink(zoomRes.data);
      setFees(feesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (assignmentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles(prev => ({
        ...prev,
        [assignmentId]: [...(prev[assignmentId] || []), ...files]
      }));
    }
  };

  const removePendingFile = (assignmentId: string, index: number) => {
    setPendingFiles(prev => ({
      ...prev,
      [assignmentId]: prev[assignmentId]?.filter((_, i) => i !== index) || []
    }));
  };

  const uploadSubmission = async (assignmentId: string) => {
    if (!user || !pendingFiles[assignmentId]?.length) return;

    setUploadingFor(assignmentId);
    setUploadProgress(0);

    const files = pendingFiles[assignmentId];
    const uploadedFiles: FileInfo[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `submissions/${assignmentId}/${user.id}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("assignment-files")
          .upload(storagePath, file);

        if (uploadError) throw new Error(`Failed to upload ${file.name}`);

        uploadedFiles.push({
          file_name: file.name,
          storage_path: storagePath,
          uploaded_by_role: "student",
          uploaded_at: new Date().toISOString(),
        });

        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Get current submission attachments
      const assignment = assignments.find(a => a.id === assignmentId);
      const existingSubmissions = assignment?.submission_attachments || [];
      const allSubmissions = [...existingSubmissions, ...uploadedFiles];

      // Update assignment
      const { error: updateError } = await supabase
        .from("assignments")
        .update({ submission_attachments: allSubmissions as unknown as undefined })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      toast({
        title: "Files uploaded",
        description: `${uploadedFiles.length} file(s) submitted successfully.`,
      });

      setPendingFiles(prev => ({ ...prev, [assignmentId]: [] }));
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setUploadingFor(null);
      setUploadProgress(0);
    }
  };

  const markAsSubmitted = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("assignments")
        .update({ status: "submitted" })
        .eq("id", assignmentId);

      if (error) throw error;

      toast({ title: "Assignment submitted!", description: "Your assignment has been marked as submitted." });
      setAssignments(prev => prev.map(a => a.id === assignmentId ? { ...a, status: "submitted" } : a));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const totalClasses = attendance.length;
  const attendedClasses = attendance.filter(a => a.status === "present").length;
  const absentClasses = attendance.filter(a => a.status === "absent").length;
  const attendancePercent = totalClasses > 0 ? Math.round((attendedClasses / totalClasses) * 100) : 0;
  const totalHours = attendance.reduce((sum, a) => sum + (a.hours || 0), 0);
  const pendingAssignments = assignments.filter(a => a.status === "pending").length;

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };
  
  const handleFeeResponse = async (feeId: string, response: "ok" | "needs_correction") => {
    try {
      const { error } = await supabase
        .from("student_fees")
        .update({ student_ack_status: response })
        .eq("id", feeId);
      
      if (error) throw error;
      
      // Notify admins
      const { data: admins } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("role", "admin");
      
      if (admins && user) {
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            recipient_id: admin.user_id,
            sender_id: user.id,
            type: "fee",
            title: response === "ok" ? "Fee Acknowledged" : "Fee Needs Correction",
            body: response === "ok" 
              ? "Student has acknowledged the fee details."
              : "Student has requested corrections to fee details.",
            entity_table: "student_fees",
            entity_id: feeId,
          });
        }
      }
      
      setFeeDialogOpen(false);
      toast({ 
        title: response === "ok" ? "Thank you!" : "Correction requested",
        description: response === "ok" 
          ? "Thank you for your cooperation." 
          : "The corrected fee details will be sent shortly."
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout 
        title="Student Dashboard" 
        roleLabel="Student" 
        roleColor="student"
        sidebarItems={studentSidebarItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-student" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Student Dashboard" 
      roleLabel="Student" 
      roleColor="student"
      sidebarItems={studentSidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Quick Stats - Always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8 dashboard-stagger-in">
        <StatCard icon={Calendar} label="Total Classes" value={totalClasses} variant="primary" />
        <StatCard icon={CheckCircle2} label="Attended" value={attendedClasses} variant="success" />
        <StatCard icon={XCircle} label="Absent" value={absentClasses} variant="destructive" />
        <StatCard icon={GraduationCap} label="Attendance" value={`${attendancePercent}%`} variant="student" />
        <StatCard icon={FileText} label="Pending Tasks" value={pendingAssignments} variant="warning" />
      </div>

      {/* Tab Content */}
      <div className="dashboard-section">
        {activeTab === "schedule" && (
          <StudentCalendar onNavigateToAssignment={() => setActiveTab("assignments")} />
        )}

        {activeTab === "attendance" && (
          <StudentAttendanceHistory attendance={attendance} />
        )}

        {activeTab === "zoom" && (
          <Card className="max-w-lg dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-student" />
                Zoom Meeting Link
              </CardTitle>
              <CardDescription>Your assigned Zoom meeting details</CardDescription>
            </CardHeader>
            <CardContent>
              {zoomLink ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    {zoomLink.meeting_id && (
                      <div className="mb-2">
                        <p className="text-sm text-muted-foreground">Meeting ID</p>
                        <p className="font-mono text-foreground">{zoomLink.meeting_id}</p>
                      </div>
                    )}
                    {zoomLink.passcode && (
                      <div>
                        <p className="text-sm text-muted-foreground">Passcode</p>
                        <p className="font-mono text-foreground">{zoomLink.passcode}</p>
                      </div>
                    )}
                  </div>
                  <Button 
                    className="w-full dashboard-btn dashboard-btn-student"
                    onClick={() => window.open(zoomLink.meeting_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join Zoom Meeting
                  </Button>
                </div>
              ) : (
                <EmptyState 
                  icon={Video}
                  title="No Zoom link assigned yet"
                  description="Your teacher will add a Zoom meeting link for your classes soon."
                />
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "notes" && (
          <StudentNotes />
        )}

        {activeTab === "assignments" && (
          <Card className="dashboard-list-card">
            <CardHeader>
              <CardTitle>My Assignments</CardTitle>
              <CardDescription>Track, download materials, and submit your work</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <EmptyState 
                  icon={FileText}
                  title="No assignments yet"
                  description="Your teacher will assign homework and materials that will appear here."
                />
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="p-4 rounded-xl border border-border hover:border-student/30 transition-all hover:shadow-md bg-card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{assignment.title}</h4>
                          {assignment.subject && <p className="text-sm text-student">{assignment.subject}</p>}
                          {assignment.description && <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>}
                          <div className="flex items-center gap-4 mt-2">
                            {assignment.due_date && (
                              <span className={`text-xs flex items-center gap-1 ${isOverdue(assignment.due_date) && assignment.status !== "submitted" ? "text-destructive" : "text-muted-foreground"}`}>
                                <Clock className="h-3 w-3" />
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                                {isOverdue(assignment.due_date) && assignment.status !== "submitted" && " (Overdue)"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {assignment.status === "submitted" ? (
                            <Badge className="bg-success/10 text-success border-success/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" />Submitted
                            </Badge>
                          ) : assignment.status === "viewed" ? (
                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              <Eye className="h-3 w-3 mr-1" />Viewed
                            </Badge>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5">Pending</Badge>
                              <Button size="sm" className="dashboard-btn dashboard-btn-student" onClick={() => markAsSubmitted(assignment.id)}>
                                Mark as Submitted
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Teacher Attachments - Downloads */}
                      {assignment.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <FileDownload files={assignment.attachments} title="Teacher Materials" />
                        </div>
                      )}

                      {/* Student Submission Section */}
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Your Submission</p>
                        
                        {/* Existing submissions */}
                        {assignment.submission_attachments.length > 0 && (
                          <div className="mb-2">
                            <FileDownload files={assignment.submission_attachments} compact />
                          </div>
                        )}

                        {/* Upload new files */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.multiple = true;
                              input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp';
                              input.onchange = (e) => handleFileSelect(assignment.id, e as unknown as React.ChangeEvent<HTMLInputElement>);
                              input.click();
                            }} 
                            disabled={uploadingFor === assignment.id}
                          >
                            <Upload className="h-4 w-4 mr-1" />Add Files
                          </Button>

                          {(pendingFiles[assignment.id]?.length || 0) > 0 && (
                            <Button 
                              type="button" 
                              size="sm" 
                              className="dashboard-btn dashboard-btn-student"
                              onClick={() => uploadSubmission(assignment.id)} 
                              disabled={uploadingFor === assignment.id}
                            >
                              {uploadingFor === assignment.id ? (
                                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Uploading...</>
                              ) : (
                                <>Upload {pendingFiles[assignment.id].length} file(s)</>
                              )}
                            </Button>
                          )}
                        </div>

                        {uploadingFor === assignment.id && <Progress value={uploadProgress} className="h-1 mt-2" />}

                        {/* Pending files list */}
                        {(pendingFiles[assignment.id]?.length || 0) > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pendingFiles[assignment.id].map((file, idx) => (
                              <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs">
                                <File className="h-3 w-3" />{file.name}
                                <button onClick={() => removePendingFile(assignment.id, idx)} className="ml-1 hover:text-destructive">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "messages" && (
          <div>
            <h3 className="text-lg font-semibold mb-4">My Teachers</h3>
            <MessagingPanel userRole="student" />
          </div>
        )}

        {activeTab === "fee-sheet" && (
          <StudentFeeSheet />
        )}

        {activeTab === "fees" && (
          <Card className="dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Fee Details
              </CardTitle>
              <CardDescription>View your fee details sent by the academy</CardDescription>
            </CardHeader>
            <CardContent>
              {fees.length === 0 ? (
                <EmptyState icon={DollarSign} title="No fee details" description="When fee details are available, they'll appear here." />
              ) : (
                <div className="space-y-4">
                  {fees.map((fee) => (
                    <div key={fee.id} className="p-4 rounded-xl border border-border hover:border-student/30 transition-all">
                      <div className="flex flex-wrap justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{fee.month}</h4>
                            {fee.student_ack_status && (
                              <Badge className={fee.student_ack_status === "ok" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                                {fee.student_ack_status === "ok" ? "Acknowledged" : "Correction Requested"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-lg font-semibold">
                            {fee.total_hours}h × ${fee.fee_per_hour}/h = ${fee.total_amount?.toFixed(2)}
                          </p>
                          {fee.subjects && <p className="text-sm text-muted-foreground">Subjects: {fee.subjects}</p>}
                          {fee.class_dates && <p className="text-sm text-muted-foreground">Dates: {fee.class_dates}</p>}
                        </div>
                        {!fee.student_ack_status && (
                          <Button 
                            className="dashboard-btn dashboard-btn-student"
                            onClick={() => { setSelectedFee(fee); setFeeDialogOpen(true); }}
                          >
                            View & Respond
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fee Acknowledgment Dialog */}
      <AlertDialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Please Call Your Parents
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please call your parents before viewing this fee information. They should review the details with you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedFee && (
            <div className="p-4 rounded-lg bg-muted my-4">
              <p className="font-semibold">{selectedFee.month}</p>
              <p className="text-xl font-bold">${selectedFee.total_amount?.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">{selectedFee.total_hours}h × ${selectedFee.fee_per_hour}/h</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedFee && handleFeeResponse(selectedFee.id, "needs_correction")}>
              No, Corrections Needed
            </AlertDialogAction>
            <AlertDialogAction 
              className="bg-success hover:bg-success/90"
              onClick={() => selectedFee && handleFeeResponse(selectedFee.id, "ok")}
            >
              OK, All Correct
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default StudentDashboard;
