import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileDownload } from "@/components/FileDownload";
import { EmptyState } from "@/components/EmptyState";
import { StudentCalendar } from "@/components/StudentCalendar";
import { MessagingPanel } from "@/components/messaging/MessagingPanel";
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
  MessageSquare
} from "lucide-react";

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

const StudentDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [zoomLink, setZoomLink] = useState<ZoomLink | null>(null);

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
      const { data: attendanceData } = await supabase
        .from("attendance_records")
        .select("id, date, status, hours, topic")
        .eq("student_user_id", user.id)
        .order("date", { ascending: false });

      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, title, subject, description, due_date, status, created_at, has_attachments, attachments, submission_attachments")
        .eq("student_user_id", user.id)
        .order("due_date", { ascending: true });

      const { data: zoomData } = await supabase
        .from("zoom_links")
        .select("meeting_url, meeting_id, passcode")
        .eq("student_user_id", user.id)
        .maybeSingle();

      setAttendance(attendanceData || []);
      setAssignments((assignmentsData || []).map(a => ({
        ...a,
        attachments: (a.attachments as unknown as FileInfo[]) || [],
        submission_attachments: (a.submission_attachments as unknown as FileInfo[]) || [],
      })));
      setZoomLink(zoomData);
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

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <DashboardLayout title="Student Dashboard" roleLabel="Student" roleColor="student">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-student" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Student Dashboard" roleLabel="Student" roleColor="student">
      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-xl">
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="zoom" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Zoom</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Assignments</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
          </TabsTrigger>
        </TabsList>

        {/* Schedule/Calendar Tab */}
        <TabsContent value="schedule">
          <StudentCalendar onNavigateToAssignment={() => {
            const tabTrigger = document.querySelector('[data-state][value="assignments"]') as HTMLElement;
            tabTrigger?.click();
          }} />
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Classes</p><p className="text-2xl font-bold text-foreground">{totalClasses}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Attended</p><p className="text-2xl font-bold text-teacher">{attendedClasses}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Absent</p><p className="text-2xl font-bold text-destructive">{absentClasses}</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Attendance %</p><p className="text-2xl font-bold text-student">{attendancePercent}%</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Hours</p><p className="text-2xl font-bold text-foreground">{totalHours}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Attendance History</CardTitle><CardDescription>Your complete attendance record</CardDescription></CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <EmptyState 
                  icon={Calendar}
                  title="No attendance records yet"
                  description="Once your teacher marks your attendance, your records will appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Hours</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Topic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((record) => (
                        <tr key={record.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4 text-sm">{new Date(record.date).toLocaleDateString()}</td>
                          <td className="py-3 px-4">
                            {record.status === "present" ? (
                              <Badge className="bg-teacher/10 text-teacher hover:bg-teacher/20"><CheckCircle2 className="h-3 w-3 mr-1" />Present</Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20"><XCircle className="h-3 w-3 mr-1" />Absent</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm">{record.hours || "-"}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{record.topic || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Zoom Tab */}
        <TabsContent value="zoom">
          <Card className="max-w-lg">
            <CardHeader><CardTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-student" />Zoom Meeting Link</CardTitle><CardDescription>Your assigned Zoom meeting details</CardDescription></CardHeader>
            <CardContent>
              {zoomLink ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    {zoomLink.meeting_id && <div className="mb-2"><p className="text-sm text-muted-foreground">Meeting ID</p><p className="font-mono text-foreground">{zoomLink.meeting_id}</p></div>}
                    {zoomLink.passcode && <div><p className="text-sm text-muted-foreground">Passcode</p><p className="font-mono text-foreground">{zoomLink.passcode}</p></div>}
                  </div>
                  <Button variant="student" className="w-full" onClick={() => window.open(zoomLink.meeting_url, "_blank")}><ExternalLink className="h-4 w-4 mr-2" />Join Zoom Meeting</Button>
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
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>My Assignments</CardTitle><CardDescription>Track, download materials, and submit your work</CardDescription></CardHeader>
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
                    <div key={assignment.id} className="p-4 rounded-lg border border-border hover:border-student/30 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{assignment.title}</h4>
                          {assignment.subject && <p className="text-sm text-student">{assignment.subject}</p>}
                          {assignment.description && <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>}
                          <div className="flex items-center gap-4 mt-2">
                            {assignment.due_date && (
                              <span className={`text-xs flex items-center gap-1 ${isOverdue(assignment.due_date) && assignment.status !== "submitted" ? "text-destructive" : "text-muted-foreground"}`}>
                                <Clock className="h-3 w-3" />Due: {new Date(assignment.due_date).toLocaleDateString()}{isOverdue(assignment.due_date) && assignment.status !== "submitted" && " (Overdue)"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {assignment.status === "submitted" ? (
                            <Badge className="bg-teacher/10 text-teacher"><CheckCircle2 className="h-3 w-3 mr-1" />Submitted</Badge>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-secondary border-secondary">Pending</Badge>
                              <Button size="sm" variant="student" onClick={() => markAsSubmitted(assignment.id)}>Mark as Submitted</Button>
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
                          <Button type="button" variant="outline" size="sm" onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = true;
                            input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp';
                            input.onchange = (e) => handleFileSelect(assignment.id, e as unknown as React.ChangeEvent<HTMLInputElement>);
                            input.click();
                          }} disabled={uploadingFor === assignment.id}>
                            <Upload className="h-4 w-4 mr-1" />Add Files
                          </Button>

                          {(pendingFiles[assignment.id]?.length || 0) > 0 && (
                            <Button type="button" variant="student" size="sm" onClick={() => uploadSubmission(assignment.id)} disabled={uploadingFor === assignment.id}>
                              {uploadingFor === assignment.id ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Uploading...</> : <>Upload {pendingFiles[assignment.id].length} file(s)</>}
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
                                <button onClick={() => removePendingFile(assignment.id, idx)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
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
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <div>
            <h3 className="text-lg font-semibold mb-4">My Teachers</h3>
            <MessagingPanel userRole="student" />
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default StudentDashboard;
