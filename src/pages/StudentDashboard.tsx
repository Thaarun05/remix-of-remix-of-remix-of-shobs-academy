import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Video, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ExternalLink,
  Loader2
} from "lucide-react";

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
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
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

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch attendance
      const { data: attendanceData } = await supabase
        .from("attendance_records")
        .select("id, date, status, hours, topic")
        .eq("student_user_id", user.id)
        .order("date", { ascending: false });

      // Fetch assignments
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, title, subject, description, due_date, status, created_at")
        .eq("student_user_id", user.id)
        .order("due_date", { ascending: true });

      // Fetch zoom link
      const { data: zoomData } = await supabase
        .from("zoom_links")
        .select("meeting_url, meeting_id, passcode")
        .eq("student_user_id", user.id)
        .maybeSingle();

      setAttendance(attendanceData || []);
      setAssignments(assignmentsData || []);
      setZoomLink(zoomData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsSubmitted = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("assignments")
        .update({ status: "submitted" })
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "Assignment submitted!",
        description: "Your assignment has been marked as submitted.",
      });

      // Refresh assignments
      setAssignments(prev =>
        prev.map(a => a.id === assignmentId ? { ...a, status: "submitted" } : a)
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit assignment.",
        variant: "destructive",
      });
    }
  };

  // Calculate attendance stats
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
      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
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
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-2xl font-bold text-foreground">{totalClasses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Attended</p>
                <p className="text-2xl font-bold text-teacher">{attendedClasses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-destructive">{absentClasses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Attendance %</p>
                <p className="text-2xl font-bold text-student">{attendancePercent}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold text-foreground">{totalHours}</p>
              </CardContent>
            </Card>
          </div>

          {/* Attendance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>Your complete attendance record</CardDescription>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No attendance records yet.
                </p>
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
                          <td className="py-3 px-4 text-sm">
                            {new Date(record.date).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            {record.status === "present" ? (
                              <Badge className="bg-teacher/10 text-teacher hover:bg-teacher/20">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Present
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20">
                                <XCircle className="h-3 w-3 mr-1" />
                                Absent
                              </Badge>
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
                    variant="student"
                    className="w-full"
                    onClick={() => window.open(zoomLink.meeting_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join Zoom Meeting
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No Zoom link assigned yet.
                    <br />
                    Your teacher will add one soon.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Assignments</CardTitle>
              <CardDescription>Track and submit your assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No assignments yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-4 rounded-lg border border-border hover:border-student/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{assignment.title}</h4>
                          {assignment.subject && (
                            <p className="text-sm text-student">{assignment.subject}</p>
                          )}
                          {assignment.description && (
                            <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            {assignment.due_date && (
                              <span className={`text-xs flex items-center gap-1 ${
                                isOverdue(assignment.due_date) && assignment.status !== "submitted"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}>
                                <Clock className="h-3 w-3" />
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                                {isOverdue(assignment.due_date) && assignment.status !== "submitted" && " (Overdue)"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {assignment.status === "submitted" ? (
                            <Badge className="bg-teacher/10 text-teacher">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Submitted
                            </Badge>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-secondary border-secondary">
                                Pending
                              </Badge>
                              <Button
                                size="sm"
                                variant="student"
                                onClick={() => markAsSubmitted(assignment.id)}
                              >
                                Mark as Submitted
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default StudentDashboard;
