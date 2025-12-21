import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Video, 
  FileText, 
  User,
  Loader2,
  Plus,
  Search
} from "lucide-react";

interface Student {
  user_id: string;
  student_name: string;
  grade: string | null;
}

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

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

      setStudents(studentsData || []);
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save attendance.",
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
      const { error } = await supabase.from("assignments").insert({
        student_user_id: selectedStudent,
        teacher_user_id: user.id,
        title: assignmentForm.title,
        subject: assignmentForm.subject || null,
        description: assignmentForm.description || null,
        due_date: assignmentForm.dueDate || null,
      });

      if (error) throw error;

      toast({
        title: "Assignment created",
        description: "The assignment has been assigned to the student.",
      });

      setAssignmentForm({
        title: "",
        subject: "",
        description: "",
        dueDate: "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create assignment.",
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save Zoom link.",
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
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

  return (
    <DashboardLayout title="Teacher Dashboard" roleLabel="Teacher" roleColor="teacher">
      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Assignments</span>
          </TabsTrigger>
          <TabsTrigger value="zoom" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Zoom</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
        </TabsList>

        {/* Student Selector - shown on all tabs except profile */}
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
            </div>
            {students.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No students registered yet.
              </p>
            )}
          </CardContent>
        </Card>

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

        {/* Assignments Tab */}
        <TabsContent value="assignments">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Assignment
              </CardTitle>
              <CardDescription>Assign work to the selected student</CardDescription>
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
                <Button
                  type="submit"
                  variant="teacher"
                  className="w-full"
                  disabled={!selectedStudent || submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create Assignment"
                  )}
                </Button>
              </form>
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
      </Tabs>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
