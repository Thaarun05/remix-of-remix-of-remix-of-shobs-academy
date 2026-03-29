import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { TeacherNotes } from "@/components/teacher/TeacherNotes";
import { Whiteboard as WhiteboardComponent } from "@/components/teacher/Whiteboard";
import { StatCard } from "@/components/dashboard/StatCard";
import { teacherSidebarItems } from "@/components/dashboard/DashboardSidebar";
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
  GraduationCap,
  DollarSign,
  Calculator,
  Send,
  Eye,
  ExternalLink,
  Trash2,
  Pencil
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface TeacherSalary {
  id: string;
  created_at: string;
  teacher_name: string | null;
  num_classes: number | null;
  total_hours: number | null;
  salary_per_hour: number | null;
  amount: number | null;
  status: string | null;
  note: string | null;
  deleted_at?: string | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
  student_user_id: string;
  student_name?: string;
  deleted_at?: string | null;
}

interface MeetLink {
  student_user_id: string;
  meet_link: string;
  student_name?: string;
  deleted_at?: string | null;
}

interface StudentFee {
  id: string;
  created_at: string;
  month: string;
  student_name: string | null;
  total_amount: number | null;
  status: string | null;
  deleted_at?: string | null;
}

const TeacherDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignments, setAssignments] = useState<AssignmentWithFiles[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [meetLinks, setMeetLinks] = useState<MeetLink[]>([]);
  const [recentFees, setRecentFees] = useState<StudentFee[]>([]);
  const [salaries, setSalaries] = useState<TeacherSalary[]>([]);
  
  // Navigation state
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
  const [meetForm, setMeetForm] = useState({
    meetLink: "",
  });
  const [profileForm, setProfileForm] = useState({
    subjects: "",
    availability: "",
    bio: "",
  });
  const [feeForm, setFeeForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    totalHours: "",
    feePerHour: "",
    classDates: "",
    subjects: "",
  });

  const [submitting, setSubmitting] = useState(false);
  
  // Attendance filter states
  const [filterMonth, setFilterMonth] = useState("");
  const [filterStudent, setFilterStudent] = useState("");
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  
  // Manage tab filter states
  const [manageFilterStudent, setManageFilterStudent] = useState("all");
  const [manageFilterSubject, setManageFilterSubject] = useState("all");

  // Edit/Delete dialogs state
  const [editAttendanceDialog, setEditAttendanceDialog] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);
  const [editAttendanceForm, setEditAttendanceForm] = useState({
    date: "",
    status: "present" as "present" | "absent",
    hours: "",
    topic: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<{ table: string; id: string; name: string } | null>(null);
  const [editAssignmentDialog, setEditAssignmentDialog] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<AssignmentWithFiles | null>(null);
  const [editAssignmentForm, setEditAssignmentForm] = useState({
    title: "",
    subject: "",
    description: "",
    dueDate: "",
  });
  const [editZoomDialog, setEditZoomDialog] = useState(false);
  const [editingZoom, setEditingZoom] = useState<ZoomLink | null>(null);
  const [editZoomForm, setEditZoomForm] = useState({
    meetingUrl: "",
    meetingId: "",
    passcode: "",
  });

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
      const [studentsRes, profileRes, assignmentsRes, salaryRes, attendanceRes, zoomRes, feesRes] = await Promise.all([
        supabase
          .from("student_profiles")
          .select("user_id, student_name, grade")
          .eq("assigned_teacher_id", user.id)
          .order("student_name"),
        supabase
          .from("teacher_profiles")
          .select("subjects, availability, bio")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("assignments")
          .select("id, title, subject, description, due_date, status, created_at, student_user_id, has_attachments, attachments, submission_attachments, deleted_at")
          .eq("teacher_user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("teacher_salary")
          .select("*")
          .eq("teacher_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("attendance_records")
          .select("id, date, status, hours, topic, student_user_id, deleted_at")
          .eq("teacher_user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("zoom_links")
          .select("student_user_id, meeting_url, meeting_id, passcode, deleted_at")
          .is("deleted_at", null),
        supabase
          .from("student_fees")
          .select("id, created_at, month, student_name, total_amount, status, deleted_at")
          .eq("teacher_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      setStudents(studentsRes.data || []);
      setSalaries(salaryRes.data || []);
      
      const studentsMap = new Map(studentsRes.data?.map(s => [s.user_id, s.student_name]) || []);
      const assignmentsWithNames = (assignmentsRes.data || []).map(a => ({
        ...a,
        attachments: (a.attachments as unknown as FileInfo[]) || [],
        submission_attachments: (a.submission_attachments as unknown as FileInfo[]) || [],
        student_name: studentsMap.get(a.student_user_id) || "Unknown Student"
      }));
      setAssignments(assignmentsWithNames);
      
      // Set attendance records with student names
      const attendanceWithNames = (attendanceRes.data || []).map(a => ({
        ...a,
        student_name: studentsMap.get(a.student_user_id) || "Unknown Student"
      }));
      setAttendanceRecords(attendanceWithNames);
      
      // Set zoom links with student names
      const zoomWithNames = (zoomRes.data || []).map(z => ({
        ...z,
        student_name: studentsMap.get(z.student_user_id) || "Unknown Student"
      }));
      setZoomLinks(zoomWithNames);
      
      setRecentFees(feesRes.data || []);

      if (profileRes.data) {
        setProfileForm({
          subjects: profileRes.data.subjects || "",
          availability: profileRes.data.availability || "",
          bio: profileRes.data.bio || "",
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

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const fetchFilteredAttendance = async () => {
    if (!user || !filterMonth || !filterStudent) return;
    setFilterLoading(true);
    try {
      const year = new Date().getFullYear();
      const monthIndex = MONTHS.indexOf(filterMonth);
      const startDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
      const endDate = monthIndex === 11
        ? `${year + 1}-01-01`
        : `${year}-${String(monthIndex + 2).padStart(2, "0")}-01`;

      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, date, status, hours, topic, student_user_id, deleted_at")
        .eq("teacher_user_id", user.id)
        .eq("student_user_id", filterStudent)
        .gte("date", startDate)
        .lt("date", endDate)
        .is("deleted_at", null)
        .order("date", { ascending: true });

      if (error) throw error;

      const studentName = students.find(s => s.user_id === filterStudent)?.student_name || "Unknown";
      setFilteredAttendance((data || []).map(a => ({ ...a, student_name: studentName })));
    } catch (error) {
      console.error("Error fetching filtered attendance:", error);
    } finally {
      setFilterLoading(false);
    }
  };

  useEffect(() => {
    if (filterMonth && filterStudent) {
      fetchFilteredAttendance();
    } else {
      setFilteredAttendance([]);
    }
  }, [filterMonth, filterStudent]);

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
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;
    setSubmitting(true);

    try {
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

      if (pendingFiles.length > 0 && newAssignment) {
        const uploadedFiles = await uploadFilesToStorage(newAssignment.id);
        
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

      if (newAssignment && assignmentForm.dueDate) {
        const dueDateTime = new Date(assignmentForm.dueDate);
        dueDateTime.setHours(23, 59, 0, 0);

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

      setAssignmentForm({ title: "", subject: "", description: "", dueDate: "" });
      setPendingFiles([]);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create assignment.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
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
        deleted_at: null,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Zoom link updated",
        description: "The Zoom meeting link has been saved for the student.",
      });

      setZoomForm({ meetingUrl: "", meetingId: "", passcode: "" });
      fetchData(); // Refresh to show the new zoom link
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save Zoom link.";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
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
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };
  
  const handleSendFeeToAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStudent) return;
    setSubmitting(true);
    
    try {
      const student = students.find(s => s.user_id === selectedStudent);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();
      
      const totalHours = parseFloat(feeForm.totalHours) || 0;
      const feePerHour = parseFloat(feeForm.feePerHour) || 0;
      const totalAmount = totalHours * feePerHour;
      
      const { error } = await supabase.from("student_fees").insert({
        student_id: selectedStudent,
        student_name: student?.student_name || null,
        teacher_id: user.id,
        teacher_name: profile?.full_name || null,
        month: feeForm.month,
        total_hours: totalHours,
        fee_per_hour: feePerHour,
        total_amount: totalAmount,
        class_dates: feeForm.classDates || null,
        subjects: feeForm.subjects || null,
        status: "sent_to_admin",
      });
      
      if (error) throw error;
      
      // Notify admins
      const { data: admins } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("role", "admin");
      
      if (admins) {
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            recipient_id: admin.user_id,
            sender_id: user.id,
            type: "fee",
            title: "New Fee Submitted",
            body: `Fee details for ${student?.student_name || "student"} (${feeForm.month}) submitted for review.`,
            entity_table: "student_fees",
          });
        }
      }
      
      toast({ title: "Fee sent", description: "Fee details have been sent to admin for review." });
      setFeeForm({ month: new Date().toISOString().slice(0, 7), totalHours: "", feePerHour: "", classDates: "", subjects: "" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleSalaryResponse = async (salaryId: string, status: "confirmed" | "needs_correction") => {
    try {
      const { error } = await supabase
        .from("teacher_salary")
        .update({ status })
        .eq("id", salaryId);
      
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
            type: "salary",
            title: status === "confirmed" ? "Salary Confirmed" : "Salary Needs Correction",
            body: status === "confirmed" 
              ? "Teacher has confirmed the salary details."
              : "Teacher has requested corrections to salary details.",
            entity_table: "teacher_salary",
            entity_id: salaryId,
          });
        }
      }
      
      toast({ 
        title: status === "confirmed" ? "Confirmed" : "Correction requested", 
        description: status === "confirmed" ? "Salary details confirmed." : "Admin has been notified about needed corrections."
      });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const handleSoftDelete = async (table: string, id: string) => {
    try {
      // Zoom links use student_user_id as the key, not id
      const column = table === "zoom_links" ? "student_user_id" : "id";
      
      const { error } = await supabase
        .from(table as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq(column, id);
      
      if (error) throw error;
      toast({ title: "Deleted", description: "Item removed successfully." });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };
  
  const openDeleteDialog = (table: string, id: string, name: string) => {
    setDeletingItem({ table, id, name });
    setDeleteDialogOpen(true);
  };
  
  const openEditAttendance = (record: AttendanceRecord) => {
    setEditingAttendance(record);
    setEditAttendanceForm({
      date: record.date,
      status: record.status as "present" | "absent",
      hours: record.hours?.toString() || "",
      topic: record.topic || "",
    });
    setEditAttendanceDialog(true);
  };
  
  const handleUpdateAttendance = async () => {
    if (!editingAttendance || !user) return;
    setSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("attendance_records")
        .update({
          date: editAttendanceForm.date,
          status: editAttendanceForm.status,
          hours: editAttendanceForm.hours ? parseFloat(editAttendanceForm.hours) : null,
          topic: editAttendanceForm.topic || null,
        })
        .eq("id", editingAttendance.id);
      
      if (error) throw error;
      
      // Notify student about updated attendance
      await supabase.from("notifications").insert({
        recipient_id: editingAttendance.student_user_id,
        sender_id: user.id,
        type: "attendance",
        title: "Attendance Updated",
        body: `Your attendance for ${editAttendanceForm.date} has been updated.`,
        entity_table: "attendance_records",
        entity_id: editingAttendance.id,
      });
      
      toast({ title: "Attendance updated", description: "The student has been notified." });
      setEditAttendanceDialog(false);
      setEditingAttendance(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  
  const openEditAssignment = (assignment: AssignmentWithFiles) => {
    setEditingAssignment(assignment);
    setEditAssignmentForm({
      title: assignment.title,
      subject: assignment.subject || "",
      description: assignment.description || "",
      dueDate: assignment.due_date || "",
    });
    setEditAssignmentDialog(true);
  };
  
  const handleUpdateAssignment = async () => {
    if (!editingAssignment || !user) return;
    setSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("assignments")
        .update({
          title: editAssignmentForm.title,
          subject: editAssignmentForm.subject || null,
          description: editAssignmentForm.description || null,
          due_date: editAssignmentForm.dueDate || null,
        })
        .eq("id", editingAssignment.id);
      
      if (error) throw error;
      
      // Notify student about updated assignment
      await supabase.from("notifications").insert({
        recipient_id: editingAssignment.student_user_id,
        sender_id: user.id,
        type: "assignment",
        title: "Assignment Updated",
        body: `The assignment "${editAssignmentForm.title}" has been updated.`,
        entity_table: "assignments",
        entity_id: editingAssignment.id,
      });
      
      toast({ title: "Assignment updated", description: "The student has been notified." });
      setEditAssignmentDialog(false);
      setEditingAssignment(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  
  const openEditZoom = (link: ZoomLink) => {
    setEditingZoom(link);
    setEditZoomForm({
      meetingUrl: link.meeting_url,
      meetingId: link.meeting_id || "",
      passcode: link.passcode || "",
    });
    setEditZoomDialog(true);
  };
  
  const handleUpdateZoomLink = async () => {
    if (!editingZoom || !user) return;
    setSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("zoom_links")
        .update({
          meeting_url: editZoomForm.meetingUrl,
          meeting_id: editZoomForm.meetingId || null,
          passcode: editZoomForm.passcode || null,
        })
        .eq("student_user_id", editingZoom.student_user_id);
      
      if (error) throw error;
      
      // Notify student about updated Zoom link
      await supabase.from("notifications").insert({
        recipient_id: editingZoom.student_user_id,
        sender_id: user.id,
        type: "zoom",
        title: "Zoom Link Updated",
        body: "Your Zoom meeting link has been updated.",
        entity_table: "zoom_links",
      });
      
      toast({ title: "Zoom link updated", description: "The student has been notified." });
      setEditZoomDialog(false);
      setEditingZoom(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleMarkAssignmentViewed = async (assignmentId: string, studentUserId: string) => {
    try {
      // Update status to viewed (keep visible for both teacher and student)
      const { error } = await supabase
        .from("assignments")
        .update({ status: "viewed" })
        .eq("id", assignmentId);
      
      if (error) throw error;
      
      // Notify student
      await supabase.from("notifications").insert({
        recipient_id: studentUserId,
        sender_id: user?.id,
        type: "assignment",
        title: "Assignment Reviewed",
        body: "Your teacher has reviewed your assignment submission.",
        entity_table: "assignments",
        entity_id: assignmentId,
      });
      
      toast({ title: "Marked as viewed", description: "Assignment has been reviewed successfully." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const pendingSubmissions = assignments.filter(a => a.status !== "submitted" && a.status !== "viewed").length;
  const submittedCount = assignments.filter(a => a.status === "submitted").length;

  const handleMessageStudent = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setActiveTab("messages");
  };

  if (loading) {
    return (
      <DashboardLayout 
        title="Teacher Dashboard" 
        roleLabel="Teacher" 
        roleColor="teacher"
        sidebarItems={teacherSidebarItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teacher" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Teacher Dashboard" 
      roleLabel="Teacher" 
      roleColor="teacher"
      sidebarItems={teacherSidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 dashboard-stagger-in">
        <StatCard icon={GraduationCap} label="Students" value={students.length} variant="teacher" />
        <StatCard icon={FileText} label="Assignments" value={assignments.length} variant="primary" />
        <StatCard icon={Clock} label="Pending" value={pendingSubmissions} variant="warning" />
        <StatCard icon={CheckCircle2} label="Submitted" value={submittedCount} variant="success" />
      </div>

      {/* Student Selector - shown on relevant tabs */}
      {activeTab !== "profile" && activeTab !== "manage" && activeTab !== "messages" && (
        <Card className="mb-6 dashboard-list-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Student</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
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
              <p className="text-sm text-muted-foreground mt-2">No students registered yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab Content */}
      <div className="dashboard-section">
        {activeTab === "calendar" && (
          <TeacherCalendar students={students.map(s => ({ user_id: s.user_id, student_name: s.student_name }))} />
        )}

        {activeTab === "attendance" && (
          <div className="space-y-6">
            {/* Attendance Filter Section */}
            <Card className="dashboard-list-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  View Attendance Records
                </CardTitle>
                <CardDescription>Select a month and student to view their attendance history</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="space-y-2 min-w-[200px] flex-1">
                    <Label>Select Month *</Label>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 min-w-[200px] flex-1">
                    <Label>Select Student *</Label>
                    <Select value={filterStudent} onValueChange={setFilterStudent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.user_id} value={s.user_id}>
                            {s.student_name} {s.grade && `(${s.grade})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => { setFilterMonth(""); setFilterStudent(""); setFilteredAttendance([]); }}
                    disabled={!filterMonth && !filterStudent}
                  >
                    <X className="h-4 w-4 mr-1" /> Clear Filters
                  </Button>
                </div>

                {/* Validation message */}
                {(!filterMonth || !filterStudent) && (filterMonth || filterStudent) && (
                  <p className="text-sm text-destructive">Please select both a month and a student to view records.</p>
                )}

                {/* Loading */}
                {filterLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-teacher" />
                  </div>
                )}

                {/* Results Table */}
                {filterMonth && filterStudent && !filterLoading && (
                  filteredAttendance.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title="No attendance records found"
                      description={`No records for ${students.find(s => s.user_id === filterStudent)?.student_name || "this student"} in ${filterMonth}.`}
                    />
                  ) : (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hours</th>
                            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAttendance.map((record) => (
                            <tr key={record.id} className="border-t border-border hover:bg-muted/30">
                              <td className="px-4 py-3">{new Date(record.date).toLocaleDateString()}</td>
                              <td className="px-4 py-3">
                                <Badge className={record.status === "present" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                                  {record.status === "present" ? "Present" : "Absent"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">{record.hours ? `${record.hours}h` : "—"}</td>
                              <td className="px-4 py-3 text-muted-foreground">{record.topic || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </CardContent>
            </Card>

            {/* Existing Record Attendance Form + Recent Records */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="dashboard-list-card">
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
                  <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={!selectedStudent || submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Attendance"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            {/* Recent Attendance Records */}
            <Card className="dashboard-list-card h-fit">
              <CardHeader>
                <CardTitle className="text-base">Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {attendanceRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No records yet</p>
                ) : (
                  attendanceRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{record.student_name}</p>
                        <p className="text-xs text-muted-foreground">{new Date(record.date).toLocaleDateString()} • {record.status}</p>
                        {record.topic && <p className="text-xs text-muted-foreground truncate">{record.topic}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Badge className={record.status === "present" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
                          {record.hours ? `${record.hours}h` : record.status}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditAttendance(record)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => openDeleteDialog("attendance_records", record.id, `${record.student_name}'s attendance`)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            </div>
          </div>
        )}

        {activeTab === "notes" && (
          <TeacherNotes />
        )}

        {activeTab === "whiteboard" && (
          <WhiteboardComponent />
        )}

        {activeTab === "assignments" && (
          <Card className="max-w-lg dashboard-list-card">
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
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
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
                    <span className="text-xs text-muted-foreground">PDF, DOC, images, etc.</span>
                  </div>

                  {uploading && (
                    <div className="space-y-1">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
                    </div>
                  )}

                  {pendingFiles.length > 0 && (
                    <div className="space-y-2">
                      {pendingFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                          <File className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePendingFile(index)} disabled={uploading}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={!selectedStudent || submitting || uploading}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Assignment {pendingFiles.length > 0 && `(${pendingFiles.length} files)`}</>}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === "manage" && (
          <Card className="dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                All Assignments
              </CardTitle>
              <CardDescription>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Select value={manageFilterStudent} onValueChange={setManageFilterStudent}>
                    <SelectTrigger className="w-[180px] h-8 bg-background"><SelectValue placeholder="All Students" /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">All Students</SelectItem>
                      {students.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={manageFilterSubject} onValueChange={setManageFilterSubject}>
                    <SelectTrigger className="w-[180px] h-8 bg-background"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="all">All Subjects</SelectItem>
                      {[...new Set(assignments.map(a => a.subject).filter(Boolean))].map(s => (
                        <SelectItem key={s!} value={s!}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(() => {
                const filtered = assignments.filter(a => {
                  if (manageFilterStudent !== "all" && a.student_user_id !== manageFilterStudent) return false;
                  if (manageFilterSubject !== "all" && a.subject !== manageFilterSubject) return false;
                  return true;
                });
                return filtered.length === 0 ? (
                <EmptyState icon={FileText} title="No assignments found" description="No assignments match the selected filters." />
              ) : (
                <div className="space-y-4">
                  {filtered.map((assignment) => (
                    <div key={assignment.id} className="p-4 rounded-xl border border-border hover:border-teacher/30 transition-all hover:shadow-md bg-card">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-foreground">{assignment.title}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              <GraduationCap className="h-3 w-3 mr-1" />
                              {assignment.student_name}
                            </Badge>
                            {assignment.subject && (
                              <Badge variant="outline" className="text-xs">
                                {assignment.subject}
                              </Badge>
                            )}
                          </div>
                          {assignment.description && <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>}
                          {assignment.due_date && (
                            <span className={`text-xs flex items-center gap-1 mt-2 ${isOverdue(assignment.due_date) && assignment.status !== "submitted" ? "text-destructive" : "text-muted-foreground"}`}>
                              <Clock className="h-3 w-3" />
                              Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {assignment.status === "submitted" ? (
                            <>
                              <Badge className="bg-success/10 text-success border-success/20">
                                <CheckCircle2 className="h-3 w-3 mr-1" />Submitted
                              </Badge>
                              <Button size="sm" className="dashboard-btn dashboard-btn-teacher" onClick={() => handleMarkAssignmentViewed(assignment.id, assignment.student_user_id)}>
                                <Eye className="h-4 w-4 mr-1" />Mark Viewed
                              </Button>
                            </>
                          ) : assignment.status === "viewed" ? (
                            <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                              <Eye className="h-3 w-3 mr-1" />Viewed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5">Pending</Badge>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleSoftDelete("assignments", assignment.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {assignment.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <FileDownload files={assignment.attachments} title="Your Attachments" />
                        </div>
                      )}

                      {assignment.submission_attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <SubmissionFiles submissionFiles={assignment.submission_attachments} studentName={assignment.student_name} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
              })()}
            </CardContent>
          </Card>
        )}

        {activeTab === "zoom" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="dashboard-list-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  {selectedStudent ? "Create / Update Zoom Link" : "Create New Zoom Link"}
                </CardTitle>
                <CardDescription>
                  {selectedStudent 
                    ? `Setting Zoom link for: ${students.find(s => s.user_id === selectedStudent)?.student_name || "Selected Student"}`
                    : "Select a student above to create or update their Zoom link"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedStudent ? (
                  <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
                    <Video className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-2">No student selected</p>
                    <p className="text-sm text-muted-foreground">Use the student selector above to choose a student</p>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateZoom} className="space-y-4">
                    <div className="p-3 bg-teacher/10 rounded-lg border border-teacher/20 mb-4">
                      <p className="text-sm font-medium text-teacher">
                        Creating link for: {students.find(s => s.user_id === selectedStudent)?.student_name}
                      </p>
                    </div>
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
                    <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={submitting}>
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Save Zoom Link
                        </>
                      )}
                    </Button>
                  </form>
                )}
                
                {/* Quick Add for Students Without Links */}
                {students.filter(s => !zoomLinks.some(z => z.student_user_id === s.user_id)).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <p className="text-sm font-medium mb-3">Students without Zoom links:</p>
                    <div className="space-y-2">
                      {students
                        .filter(s => !zoomLinks.some(z => z.student_user_id === s.user_id))
                        .map(student => (
                          <div key={student.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                            <span className="text-sm">{student.student_name}</span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-7"
                              onClick={() => setSelectedStudent(student.user_id)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              Add Link
                            </Button>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Active Zoom Links */}
            <Card className="dashboard-list-card h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-4 w-4" />
                  Active Zoom Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                {zoomLinks.filter(link => students.some(s => s.user_id === link.student_user_id)).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No Zoom links set for your students</p>
                ) : (
                  zoomLinks
                    .filter(link => students.some(s => s.user_id === link.student_user_id))
                    .map((link) => (
                      <div key={link.student_user_id} className="p-4 rounded-xl border border-border hover:border-teacher/30 transition-all hover:shadow-md bg-card">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground">{link.student_name}</p>
                            <p className="text-xs text-muted-foreground mt-1 break-all">{link.meeting_url}</p>
                          </div>
                          <Button
                            size="sm"
                            className="dashboard-btn dashboard-btn-teacher shrink-0"
                            onClick={() => window.open(link.meeting_url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Join
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {link.meeting_id && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">ID:</span> {link.meeting_id}
                            </span>
                          )}
                          {link.passcode && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Passcode:</span> {link.passcode}
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/50">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => openEditZoom(link)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog("zoom_links", link.student_user_id, `${link.student_name}'s Zoom link`)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "messages" && (
          <div>
            <h3 className="text-lg font-semibold mb-4">My Students</h3>
            <MessagingPanel userRole="teacher" preselectedConversationId={selectedConversationId} />
          </div>
        )}

        {activeTab === "profile" && (
          <Card className="max-w-lg dashboard-list-card">
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
                <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Profile"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === "fees" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="dashboard-list-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Student Fee Calculator
                </CardTitle>
                <CardDescription>Calculate and send fee details to admin</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendFeeToAdmin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Month *</Label>
                      <Input type="month" value={feeForm.month} onChange={(e) => setFeeForm({ ...feeForm, month: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Hours *</Label>
                      <Input type="number" step="0.5" placeholder="e.g., 20" value={feeForm.totalHours} onChange={(e) => setFeeForm({ ...feeForm, totalHours: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fee Per Hour *</Label>
                    <Input type="number" step="0.01" placeholder="e.g., 30.00" value={feeForm.feePerHour} onChange={(e) => setFeeForm({ ...feeForm, feePerHour: e.target.value })} required />
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold text-teacher">${((parseFloat(feeForm.totalHours) || 0) * (parseFloat(feeForm.feePerHour) || 0)).toFixed(2)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Class Dates</Label>
                    <Textarea placeholder="e.g., Jan 5, 7, 12, 14..." value={feeForm.classDates} onChange={(e) => setFeeForm({ ...feeForm, classDates: e.target.value })} rows={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subjects Covered</Label>
                    <Textarea placeholder="e.g., Algebra, Geometry..." value={feeForm.subjects} onChange={(e) => setFeeForm({ ...feeForm, subjects: e.target.value })} rows={2} />
                  </div>
                  <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={!selectedStudent || submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Send to Admin</>}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            <Card className="dashboard-list-card h-fit">
              <CardHeader><CardTitle className="text-base">Recent Fees Sent</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {recentFees.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No fees sent yet</p>
                ) : (
                  recentFees.map((fee) => (
                    <div key={fee.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{fee.student_name}</p>
                        <p className="text-xs text-muted-foreground">{fee.month} • ${fee.total_amount?.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={fee.status === "sent_to_student" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>{fee.status === "sent_to_student" ? "Sent" : "Pending"}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleSoftDelete("student_fees", fee.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "salary" && (
          <Card className="dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                My Salary
              </CardTitle>
              <CardDescription>View and respond to salary details from admin</CardDescription>
            </CardHeader>
            <CardContent>
              {salaries.length === 0 ? (
                <EmptyState icon={DollarSign} title="No salary records" description="When admin sends salary details, they'll appear here." />
              ) : (
                <div className="space-y-4">
                  {salaries.map((salary) => (
                    <div key={salary.id} className="p-4 rounded-xl border border-border hover:border-teacher/30 transition-all">
                      <div className="flex flex-wrap justify-between items-start gap-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            {new Date(salary.created_at || "").toLocaleDateString()}
                          </p>
                          <p className="text-lg font-semibold">
                            {salary.total_hours}h × ${salary.salary_per_hour}/h = ${salary.amount?.toFixed(2)}
                          </p>
                          {salary.num_classes && <p className="text-sm text-muted-foreground">{salary.num_classes} classes</p>}
                          {salary.note && <p className="text-sm text-muted-foreground">Note: {salary.note}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className={
                            salary.status === "confirmed" ? "bg-success/10 text-success" :
                            salary.status === "needs_correction" ? "bg-destructive/10 text-destructive" :
                            "bg-warning/10 text-warning"
                          }>
                            {salary.status === "sent_to_teacher" ? "Pending Review" : salary.status}
                          </Badge>
                          {salary.status === "sent_to_teacher" && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                className="dashboard-btn dashboard-btn-teacher"
                                onClick={() => handleSalaryResponse(salary.id, "confirmed")}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-1" />Yes, All Correct
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleSalaryResponse(salary.id, "needs_correction")}
                              >
                                Need Corrections
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Edit Attendance Dialog */}
      <Dialog open={editAttendanceDialog} onOpenChange={setEditAttendanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Attendance</DialogTitle>
            <DialogDescription>Update the attendance record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={editAttendanceForm.date} onChange={(e) => setEditAttendanceForm({ ...editAttendanceForm, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editAttendanceForm.status} onValueChange={(v) => setEditAttendanceForm({ ...editAttendanceForm, status: v as "present" | "absent" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hours</Label>
              <Input type="number" step="0.5" value={editAttendanceForm.hours} onChange={(e) => setEditAttendanceForm({ ...editAttendanceForm, hours: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Topic</Label>
              <Input value={editAttendanceForm.topic} onChange={(e) => setEditAttendanceForm({ ...editAttendanceForm, topic: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAttendanceDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateAttendance} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Zoom Dialog */}
      <Dialog open={editZoomDialog} onOpenChange={setEditZoomDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Zoom Link</DialogTitle>
            <DialogDescription>Update the Zoom meeting details for {editingZoom?.student_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meeting URL</Label>
              <Input 
                type="url" 
                placeholder="https://zoom.us/j/..." 
                value={editZoomForm.meetingUrl} 
                onChange={(e) => setEditZoomForm({ ...editZoomForm, meetingUrl: e.target.value })} 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meeting ID</Label>
                <Input 
                  placeholder="123 456 7890" 
                  value={editZoomForm.meetingId} 
                  onChange={(e) => setEditZoomForm({ ...editZoomForm, meetingId: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Passcode</Label>
                <Input 
                  placeholder="abc123" 
                  value={editZoomForm.passcode} 
                  onChange={(e) => setEditZoomForm({ ...editZoomForm, passcode: e.target.value })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditZoomDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateZoomLink} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingItem?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingItem && handleSoftDelete(deletingItem.table, deletingItem.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default TeacherDashboard;
