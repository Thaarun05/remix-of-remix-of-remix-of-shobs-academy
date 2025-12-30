import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { FileDownload, SubmissionFiles } from "@/components/FileDownload";
import { TeacherCalendar } from "@/components/TeacherCalendar";
import { MessagingPanel } from "@/components/messaging/MessagingPanel";
import { StartConversationButton } from "@/components/messaging/StartConversationButton";
import { 
  Calendar, 
  Video, 
  FileText, 
  User,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
  File,
  ClipboardList,
  CheckCircle2,
  Clock,
  CalendarDays,
  MessageSquare
} from "lucide-react";

interface Student {
  user_id: string;
  student_name: string;
  grade: string | null;
}

interface FileInfo {
  file_name: string;
  storage_path: string;
  uploaded_by_role: "teacher" | "student";
  uploaded_at: string;
}

interface AssignmentWithFiles {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  student_user_id: string;
  has_attachments: boolean;
  attachments: FileInfo[];
  submission_attachments: FileInfo[];
  student_name?: string;
}

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignments, setAssignments] = useState<AssignmentWithFiles[]>([]);
  
  // Messaging state
  const [activeTab, setActiveTab] = useState("calendar");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Form states
  const [selectedStudent, setSelectedStudent] = useState("");
  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toISOString().split("T")[0],
    status: "present" as "present" | "absent",
    hours: "",
    topic: "",
  });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    subject: "",
    description: "",
    dueDate: "",
  });
  const [zoomForm, setZoomForm] = useState({
    meetingUrl: "",
    meetingId: "",
    passcode: "",
  });
  const [profileForm, setProfileForm] = useState({
    subjects: "",
    availability: "",
    bio: "",
  });

  const [submitting, setSubmitting] = useState(false);

  // File upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch students
      const { data: studentsData } = await supabase
        .from("student_profiles")
        .select("user_id, student_name, grade")
        .order("student_name");

      // Fetch teacher profile
      const { data: profileData } = await supabase
        .from("teacher_profiles")
        .select("subjects, availability, bio")
        .eq("user_id", user.id)
        .maybeSingle();

      // Fetch assignments created by this teacher
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, title, subject, description, due_date, status, created_at, student_user_id, has_attachments, attachments, submission_attachments")
        .eq("teacher_user_id", user.id)
        .order("created_at", { ascending: false });

      setStudents(studentsData || []);
      
      // Map student names to assignments
      const studentsMap = new Map(studentsData?.map(s => [s.user_id, s.student_name]) || []);
      const assignmentsWithNames = (assignmentsData || []).map(a => ({
        ...a,
        attachments: (a.attachments as unknown as FileInfo[]) || [],
        submission_attachments: (a.submission_attachments as unknown as FileInfo[]) || [],
        student_name: studentsMap.get(a.student_user_id) || "Unknown Student"
      }));
      setAssignments(assignmentsWithNames);

      if (profileData) {
        setProfileForm({
          subjects: profileData.subjects || "",
          availability: profileData.availability || "",
          bio: profileData.bio || "",
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.student_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (assignmentId: string): Promise<FileInfo[]> => {
    if (pendingFiles.length === 0) return [];

    setUploading(true);
    setUploadProgress(0);

    const uploadedFiles: FileInfo[] = [];
    const totalFiles = pendingFiles.length;

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `assignments/${assignmentId}/${timestamp}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("assignment-files")
          .upload(storagePath, file);

        if (uploadError) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        uploadedFiles.push({
          file_name: file.name,
          storage_path: storagePath,
          uploaded_by_role: "teacher",
          uploaded_at: new Date().toISOString(),
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      return uploadedFiles;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from("attendance_records").insert({
        student_user_id: selectedStudent,
        teacher_user_id: user.id,
        date: attendanceForm.date,
        status: attendanceForm.status,
        hours: attendanceForm.hours ? parseFloat(attendanceForm.hours) : null,
        topic: attendanceForm.topic || null,
      });

      if (error) throw error;

      toast({
        title: "Attendance recorded",
        description: "The attendance record has been saved.",
      });

      setAttendanceForm({
        date: new Date().toISOString().split("T")[0],
        status: "present",
        hours: "",
        topic: "",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save attendance.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;
    setSubmitting(true);

    try {
      // First create the assignment
      const { data: newAssignment, error } = await supabase.from("assignments").insert({
        student_user_id: selectedStudent,
        teacher_user_id: user.id,
        title: assignmentForm.title,
        subject: assignmentForm.subject || null,
        description: assignmentForm.description || null,
        due_date: assignmentForm.dueDate || null,
        has_attachments: pendingFiles.length > 0,
        attachments: [] as unknown as undefined,
      }).select().single();

      if (error) throw error;

      // Upload files if any
      if (pendingFiles.length > 0 && newAssignment) {
        const uploadedFiles = await uploadFilesToStorage(newAssignment.id);
        
        // Update assignment with file metadata
        const { error: updateError } = await supabase
          .from("assignments")
          .update({
            attachments: uploadedFiles as unknown as undefined,
            has_attachments: true,
          })
          .eq("id", newAssignment.id);

        if (updateError) {
          console.error("Failed to update assignment with attachments:", updateError);
        }
      }

      // Create a calendar event for the assignment (if due date is set)
      if (newAssignment && assignmentForm.dueDate) {
        const dueDateTime = new Date(assignmentForm.dueDate);
        dueDateTime.setHours(23, 59, 0, 0); // Set to end of day

        await supabase.from("events").insert({
          title: `Due: ${assignmentForm.title}`,
          description: assignmentForm.description || null,
          event_type: "assignment",
          start_time: dueDateTime.toISOString(),
          student_user_id: selectedStudent,
          teacher_user_id: user.id,
          assignment_id: newAssignment.id,
          created_by: user.id,
        });
      }

      toast({
        title: "Assignment created",
        description: pendingFiles.length > 0 
          ? `Assignment created with ${pendingFiles.length} attachment(s).`
          : "The assignment has been assigned to the student.",
      });

      setAssignmentForm({
        title: "",
        subject: "",
        description: "",
        dueDate: "",
      });
      setPendingFiles([]);
      fetchData(); // Refresh to show new assignment
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create assignment.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateZoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from("zoom_links").upsert({
        student_user_id: selectedStudent,
        meeting_url: zoomForm.meetingUrl,
        meeting_id: zoomForm.meetingId || null,
        passcode: zoomForm.passcode || null,
      });

      if (error) throw error;

      toast({
        title: "Zoom link updated",
        description: "The Zoom meeting link has been saved for the student.",
      });

      setZoomForm({
        meetingUrl: "",
        meetingId: "",
        passcode: "",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save Zoom link.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from("teacher_profiles").upsert({
        user_id: user.id,
        subjects: profileForm.subjects || null,
        availability: profileForm.availability || null,
        bio: profileForm.bio || null,
      });

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been saved.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update profile.";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <DashboardLayout title="Teacher Dashboard" roleLabel="Teacher" roleColor="teacher">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teacher" />
        </div>
      </DashboardLayout>
    );
  }

  const handleMessageStudent = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setActiveTab("messages");
  };

  return (
    <DashboardLayout title="Teacher Dashboard" roleLabel="Teacher" roleColor="teacher">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7 max-w-3xl">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Assignments</span>
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Manage</span>
          </TabsTrigger>
          <TabsTrigger value="zoom" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Zoom</span>
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Messages</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
        </TabsList>

        {/* Student Selector - shown on all tabs except profile, manage, and messages */}
        {activeTab !== "profile" && activeTab !== "manage" && activeTab !== "messages" && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Student</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStudents.map((student) => (
                    <SelectItem key={student.user_id} value={student.user_id}>
                      {student.student_name} {student.grade && `(${student.grade})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStudent && (
                <StartConversationButton
                  studentUserId={selectedStudent}
                  onConversationCreated={handleMessageStudent}
                />
              )}
            </div>
            {students.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No students registered yet.
              </p>
            )}
        </CardContent>
        </Card>
        )}

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <TeacherCalendar students={students.map(s => ({ user_id: s.user_id, student_name: s.student_name }))} />
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Record Attendance
              </CardTitle>
              <CardDescription>Mark attendance for the selected student</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAttendance} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={attendanceForm.date}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={attendanceForm.status}
                      onValueChange={(v) => setAttendanceForm({ ...attendanceForm, status: v as "present" | "absent" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hours">Hours (optional)</Label>
                  <Input
                    id="hours"
                    type="number"
                    step="0.5"
                    placeholder="e.g., 2"
                    value={attendanceForm.hours}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, hours: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic (optional)</Label>
                  <Input
                    id="topic"
                    placeholder="What was covered in class?"
                    value={attendanceForm.topic}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, topic: e.target.value })}
                  />
                </div>
                <Button
                  type="submit"
                  variant="teacher"
                  className="w-full"
                  disabled={!selectedStudent || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Record Attendance"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab - Create new assignments */}
        <TabsContent value="assignments">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Assignment
              </CardTitle>
              <CardDescription>Assign work to the selected student with file attachments</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAssignment} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Assignment title"
                    value={assignmentForm.title}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      placeholder="e.g., Mathematics"
                      value={assignmentForm.subject}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      value={assignmentForm.dueDate}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Assignment details..."
                    value={assignmentForm.description}
                    onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* File Attachments Section */}
                <div className="space-y-3 pt-2 border-t">
                  <Label className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Attachments
                  </Label>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Files
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                    />
                    <span className="text-xs text-muted-foreground">
                      PDF, DOC, images, etc.
                    </span>
                  </div>

                  {/* Upload Progress */}
                  {uploading && (
                    <div className="space-y-1">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
                    </div>
                  )}

                  {/* Pending Files */}
                  {pendingFiles.length > 0 && (
                    <div className="space-y-2">
                      {pendingFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
                        >
                          <File className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removePendingFile(index)}
                            disabled={uploading}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="teacher"
                  className="w-full"
                  disabled={!selectedStudent || submitting || uploading}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>Create Assignment {pendingFiles.length > 0 && `(${pendingFiles.length} files)`}</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manage Assignments Tab - View all assignments and submissions */}
        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                All Assignments
              </CardTitle>
              <CardDescription>View and manage assignments you've created</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No assignments created yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="p-4 rounded-lg border border-border hover:border-teacher/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{assignment.title}</h4>
                          <p className="text-sm text-teacher">{assignment.student_name}</p>
                          {assignment.subject && (
                            <p className="text-xs text-muted-foreground">{assignment.subject}</p>
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
                            <Badge variant="outline" className="text-secondary border-secondary">
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Teacher Attachments */}
                      {assignment.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <FileDownload 
                            files={assignment.attachments} 
                            title="Your Attachments"
                          />
                        </div>
                      )}

                      {/* Student Submissions */}
                      {assignment.submission_attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <SubmissionFiles 
                            submissionFiles={assignment.submission_attachments}
                            studentName={assignment.student_name}
                          />
                        </div>
                      )}
                    </div>
                  ))}
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
                <Video className="h-5 w-5" />
                Manage Zoom Link
              </CardTitle>
              <CardDescription>Set the Zoom meeting link for the selected student</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateZoom} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meetingUrl">Meeting URL *</Label>
                  <Input
                    id="meetingUrl"
                    type="url"
                    placeholder="https://zoom.us/j/..."
                    value={zoomForm.meetingUrl}
                    onChange={(e) => setZoomForm({ ...zoomForm, meetingUrl: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="meetingId">Meeting ID</Label>
                    <Input
                      id="meetingId"
                      placeholder="123 456 7890"
                      value={zoomForm.meetingId}
                      onChange={(e) => setZoomForm({ ...zoomForm, meetingId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passcode">Passcode</Label>
                    <Input
                      id="passcode"
                      placeholder="abc123"
                      value={zoomForm.passcode}
                      onChange={(e) => setZoomForm({ ...zoomForm, passcode: e.target.value })}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="teacher"
                  className="w-full"
                  disabled={!selectedStudent || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save Zoom Link"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                My Profile
              </CardTitle>
              <CardDescription>Update your teacher profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subjects">Subjects</Label>
                  <Input
                    id="subjects"
                    placeholder="e.g., Math, Physics, Chemistry"
                    value={profileForm.subjects}
                    onChange={(e) => setProfileForm({ ...profileForm, subjects: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="availability">Availability</Label>
                  <Input
                    id="availability"
                    placeholder="e.g., Mon-Fri 9am-5pm"
                    value={profileForm.availability}
                    onChange={(e) => setProfileForm({ ...profileForm, availability: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    placeholder="Tell students about yourself..."
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    rows={4}
                  />
                </div>
                <Button
                  type="submit"
                  variant="teacher"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Update Profile"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <div>
            <h3 className="text-lg font-semibold mb-4">My Students</h3>
            <MessagingPanel 
              userRole="teacher" 
              preselectedConversationId={selectedConversationId}
            />
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
