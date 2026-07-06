import { useState, useEffect, useRef, lazy, Suspense, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StartConversationButton } from "@/components/messaging/StartConversationButton";
import { StatCard } from "@/components/dashboard/StatCard";
import { teacherSidebarItems } from "@/components/dashboard/DashboardSidebar";
import {
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  Search,
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
import type {
  AssignmentWithFiles,
  AttendanceRecord,
  FileInfo,
  MeetLink,
  Student,
  StudentFee,
  TabContext,
  TeacherSalary,
} from "@/components/teacher/tabs/types";

const CalendarTab = lazy(() => import("@/components/teacher/tabs/CalendarTab"));
const AttendanceTab = lazy(() => import("@/components/teacher/tabs/AttendanceTab"));
const NotesTab = lazy(() => import("@/components/teacher/tabs/NotesTab"));
const WorkDoneTab = lazy(() => import("@/components/teacher/tabs/WorkDoneTab"));
const WhiteboardTab = lazy(() => import("@/components/teacher/tabs/WhiteboardTab"));
const ResourcesTab = lazy(() => import("@/components/teacher/tabs/ResourcesTab"));
const RecordingsTab = lazy(() => import("@/components/teacher/tabs/RecordingsTab"));
const WorksheetBuilderTab = lazy(() => import("@/components/teacher/tabs/WorksheetBuilderTab"));
const AiNotetakerTab = lazy(() => import("@/components/teacher/tabs/AiNotetakerTab"));
const QuizMakerTab = lazy(() => import("@/components/teacher/tabs/QuizMakerTab"));
const AssignmentsTab = lazy(() => import("@/components/teacher/tabs/AssignmentsTab"));
const ManageAssignmentsTab = lazy(() => import("@/components/teacher/tabs/ManageAssignmentsTab"));
const ZoomTab = lazy(() => import("@/components/teacher/tabs/ZoomTab"));
const MessagingTab = lazy(() => import("@/components/teacher/tabs/MessagingTab"));
const ProfileTab = lazy(() => import("@/components/teacher/tabs/ProfileTab"));
const FeesTab = lazy(() => import("@/components/teacher/tabs/FeesTab"));
const SalaryTab = lazy(() => import("@/components/teacher/tabs/SalaryTab"));

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
    zoomLink: "",
    classLabel: "",
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
    student_user_id: "",
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
  const [editMeetDialog, setEditMeetDialog] = useState(false);
  const [editingMeet, setEditingMeet] = useState<MeetLink | null>(null);
  const [editMeetForm, setEditMeetForm] = useState({
    zoomLink: "",
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
          .from("student_teacher_assignments")
          .select("student_user_id, student_profiles!inner(user_id, student_name, grade)")
          .eq("teacher_user_id", user.id),
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
          .from("meet_links")
          .select("student_user_id, teacher_user_id, zoom_link, deleted_at")
          .eq("teacher_user_id", user.id)
          .is("deleted_at", null),
        supabase
          .from("student_fees")
          .select("id, created_at, month, student_name, total_amount, status, deleted_at")
          .eq("teacher_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(10)
      ]);

      const studentsList: Student[] = ((studentsRes.data || []) as any[])
        .map((r) => r.student_profiles)
        .filter(Boolean)
        .sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""));
      setStudents(studentsList);
      setSalaries(salaryRes.data || []);

      const studentsMap = new Map(studentsList.map((s) => [s.user_id, s.student_name]));
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
      
      // Set meet links with student names
      const meetWithNames = (zoomRes.data || []).map((z: any) => ({
        ...z,
        student_name: studentsMap.get(z.student_user_id) || "Unknown Student"
      }));
      setMeetLinks(meetWithNames);
      
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
      let query = supabase
        .from(table as any)
        .update({ deleted_at: new Date().toISOString() });
      if (table === "meet_links") {
        // id format: "studentId|teacherId"
        const [studentId, teacherId] = id.split("|");
        query = query.eq("student_user_id", studentId).eq("teacher_user_id", teacherId);
      } else {
        query = query.eq("id", id);
      }
      const { error } = await query;
      
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
      student_user_id: record.student_user_id,
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
  
  const openEditMeet = (link: MeetLink) => {
    setEditingMeet(link);
    setEditMeetForm({
      zoomLink: link.zoom_link || "",
    });
    setEditMeetDialog(true);
  };
  
  const handleUpdateMeetLink = async () => {
    if (!editingMeet || !user) return;
    setSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("meet_links")
        .update({
          zoom_link: editMeetForm.zoomLink,
        })
        .eq("student_user_id", editingMeet.student_user_id)
        .eq("teacher_user_id", user.id);
      
      if (error) throw error;
      
      // Notify student about updated Zoom link
      await supabase.from("notifications").insert({
        recipient_id: editingMeet.student_user_id,
        sender_id: user.id,
        type: "zoom",
        title: "Zoom Link Updated",
        body: "Your teacher updated their Zoom link.",
        entity_table: "meet_links",
      });
      
      toast({ title: "Zoom link updated", description: "The student has been notified." });
      setEditMeetDialog(false);
      setEditingMeet(null);
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

  const ctx: TabContext = {
    students, assignments, attendanceRecords, meetLinks, recentFees, salaries,
    selectedStudent, setSelectedStudent, selectedConversationId,
    attendanceForm, setAttendanceForm,
    assignmentForm, setAssignmentForm,
    meetForm, setMeetForm,
    profileForm, setProfileForm,
    feeForm, setFeeForm,
    submitting, setSubmitting,
    uploading, uploadProgress, pendingFiles, setPendingFiles,
    fileInputRef, handleFileSelect, removePendingFile,
    filterMonth, setFilterMonth, filterStudent, setFilterStudent,
    filteredAttendance, setFilteredAttendance, filterLoading,
    manageFilterStudent, setManageFilterStudent,
    manageFilterSubject, setManageFilterSubject,
    handleAddAttendance, handleAddAssignment, handleUpdateProfile,
    handleSendFeeToAdmin, handleSalaryResponse, handleSoftDelete,
    handleMarkAssignmentViewed, openDeleteDialog, openEditAttendance, openEditMeet,
    isOverdue, fetchData,
    MONTHS,
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
      {activeTab !== "profile" && activeTab !== "manage" && activeTab !== "messages" && activeTab !== "work-done" && activeTab !== "ai-notetaker" && activeTab !== "worksheet-builder" && activeTab !== "quiz-maker" && (
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
        <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-teacher" /></div>}>
          {activeTab === "calendar" && <CalendarTab ctx={ctx} />}
          {activeTab === "attendance" && <AttendanceTab ctx={ctx} />}
          {activeTab === "notes" && <NotesTab />}
          {activeTab === "work-done" && <WorkDoneTab />}
          {activeTab === "whiteboard" && <WhiteboardTab />}
          {activeTab === "resources" && <ResourcesTab />}
          {activeTab === "recordings" && <RecordingsTab />}
          {activeTab === "worksheet-builder" && <WorksheetBuilderTab />}
          {activeTab === "ai-notetaker" && <AiNotetakerTab />}
          {activeTab === "quiz-maker" && <QuizMakerTab />}
          {activeTab === "assignments" && <AssignmentsTab ctx={ctx} />}
          {activeTab === "manage" && <ManageAssignmentsTab ctx={ctx} />}
          {activeTab === "zoom" && <ZoomTab ctx={ctx} />}
          {activeTab === "messages" && <MessagingTab ctx={ctx} />}
          {activeTab === "profile" && <ProfileTab ctx={ctx} />}
          {activeTab === "fees" && <FeesTab ctx={ctx} />}
          {activeTab === "salary" && <SalaryTab ctx={ctx} />}
        </Suspense>
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
      
      {/* Edit Zoom Link Dialog */}
      <Dialog open={editMeetDialog} onOpenChange={setEditMeetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Zoom Link</DialogTitle>
            <DialogDescription>Update your Zoom link for {editingMeet?.student_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Zoom URL *</Label>
              <Input 
                type="url" 
                placeholder="https://zoom.us/j/xxxxxxxxx" 
                value={editMeetForm.zoomLink} 
                onChange={(e) => setEditMeetForm({ ...editMeetForm, zoomLink: e.target.value })} 
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMeetDialog(false)}>Cancel</Button>
            <Button onClick={handleUpdateMeetLink} disabled={submitting}>
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
