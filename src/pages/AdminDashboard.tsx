import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { MessagingPanel } from "@/components/messaging/MessagingPanel";
import { AdminTeacherMessaging } from "@/components/messaging/AdminTeacherMessaging";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/dashboard/StatCard";
import { adminSidebarItems } from "@/components/dashboard/DashboardSidebar";
import { AttendanceBasedFeeCalculator } from "@/components/admin/AttendanceBasedFeeCalculator";
import { FamilyManagement } from "@/components/admin/FamilyManagement";
import { UserManagement } from "@/components/admin/UserManagement";
import { MultiTeacherAssign } from "@/components/admin/MultiTeacherAssign";
import { WorkSubmissions } from "@/components/admin/WorkSubmissions";
import { AdminWorkDone } from "@/components/admin/AdminWorkDone";
import { TeacherResources } from "@/components/teacher/TeacherResources";
import { AdminRecordingSubmissions } from "@/components/admin/AdminRecordingSubmissions";
import { 
  Users, 
  GraduationCap,
  UserPlus,
  Loader2,
  CheckCircle2,
  CalendarCheck,
  Mail,
  Phone,
  Clock,
  XCircle,
  Check,
  Trash2,
  Calculator,
  DollarSign,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { z } from "zod";

interface Profile {
  user_id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

interface TeacherSalary {
  id: string;
  created_at: string;
  teacher_id: string;
  teacher_name: string | null;
  num_classes: number | null;
  total_hours: number | null;
  salary_per_hour: number | null;
  amount: number | null;
  status: string | null;
  note: string | null;
}

interface StudentFee {
  id: string;
  created_at: string;
  month: string;
  student_id: string;
  student_name: string | null;
  teacher_id: string;
  teacher_name: string | null;
  total_hours: number | null;
  fee_per_hour: number | null;
  total_amount: number | null;
  class_dates: string | null;
  subjects: string | null;
  status: string | null;
  admin_viewed_at: string | null;
  student_ack_status: string | null;
}

interface DemoRequest {
  id: string;
  created_at: string;
  student_name: string;
  parent_name: string;
  parent_email: string;
  age: string;
  grade: string;
  subject: string;
  timing: string;
  days: string;
  phone: string;
  status: string;
}

const createTeacherSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required").max(100, "Name is too long"),
  phone: z.string().max(20, "Phone is too long").optional(),
  subjects: z.string().max(200, "Subjects is too long").optional(),
  availability: z.string().max(100, "Availability is too long").optional(),
  bio: z.string().max(500, "Bio is too long").optional(),
});

const createStudentSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  studentName: z.string().min(2, "Student name is required").max(100, "Name is too long"),
  fullName: z.string().max(100, "Full name is too long").optional(),
  phone: z.string().max(20, "Phone is too long").optional(),
  grade: z.string().max(50, "Grade is too long").optional(),
  assignedTeacherIds: z.array(z.string().uuid()).min(1, "Please assign at least one teacher"),
});

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [teacherSalaries, setTeacherSalaries] = useState<TeacherSalary[]>([]);
  const [studentFees, setStudentFees] = useState<StudentFee[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createTeacherSuccess, setCreateTeacherSuccess] = useState(false);
  const [createStudentSuccess, setCreateStudentSuccess] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<string | null>(null);
  const [demoFilter, setDemoFilter] = useState<"all" | "pending" | "approved" | "done">("pending");
  const [activeTab, setActiveTab] = useState("demo-requests");
  
  // Salary calculator form
  const [salaryForm, setSalaryForm] = useState({
    teacherId: "",
    numClasses: "",
    totalHours: "",
    salaryPerHour: "",
    note: "",
  });
  
  const [teacherForm, setTeacherForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    subjects: "",
    availability: "",
    bio: "",
  });

  const [studentForm, setStudentForm] = useState({
    email: "",
    password: "",
    studentName: "",
    fullName: "",
    phone: "",
    grade: "",
    assignedTeacherIds: [] as string[],
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [profilesRes, demoRes, salaryRes, feesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, role, full_name, phone, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("demo_requests")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("teacher_salary")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("student_fees")
          .select("*")
          .eq("status", "sent_to_admin")
          .order("created_at", { ascending: false })
      ]);

      setProfiles(profilesRes.data || []);
      setDemoRequests(demoRes.data || []);
      setTeacherSalaries(salaryRes.data || []);
      setStudentFees(feesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const teachers = profiles.filter(p => p.role === "teacher");
  
  const handleSendSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryForm.teacherId) return;
    setSubmitting(true);
    
    try {
      const teacher = teachers.find(t => t.user_id === salaryForm.teacherId);
      const totalHours = parseFloat(salaryForm.totalHours) || 0;
      const salaryPerHour = parseFloat(salaryForm.salaryPerHour) || 0;
      const totalAmount = totalHours * salaryPerHour;
      
      const { error } = await supabase.from("teacher_salary").insert({
        teacher_id: salaryForm.teacherId,
        teacher_name: teacher?.full_name || null,
        num_classes: parseInt(salaryForm.numClasses) || null,
        total_hours: totalHours,
        salary_per_hour: salaryPerHour,
        amount: totalAmount,
        note: salaryForm.note || null,
        status: "sent_to_teacher",
      });
      
      if (error) throw error;
      
      // Create notification for teacher
      await supabase.from("notifications").insert({
        recipient_id: salaryForm.teacherId,
        sender_id: user.id,
        type: "salary",
        title: "Salary Details Sent",
        body: `Your salary details have been sent. Total amount: $${totalAmount.toFixed(2)}`,
        entity_table: "teacher_salary",
      });
      
      toast({ title: "Salary sent", description: "Salary details have been sent to the teacher." });
      setSalaryForm({ teacherId: "", numClasses: "", totalHours: "", salaryPerHour: "", note: "" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleMarkFeeViewed = async (fee: StudentFee) => {
    try {
      const { error } = await supabase
        .from("student_fees")
        .update({ status: "sent_to_student", admin_viewed_at: new Date().toISOString() })
        .eq("id", fee.id);
      
      if (error) throw error;
      
      // Notify student
      await supabase.from("notifications").insert({
        recipient_id: fee.student_id,
        sender_id: user?.id,
        type: "fee",
        title: "Fee Details Available",
        body: `Your fee details for ${fee.month} are now available to view.`,
        entity_table: "student_fees",
        entity_id: fee.id,
      });
      
      toast({ title: "Fee forwarded", description: "Fee details have been sent to the student." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSendConfirmation = async (request: DemoRequest) => {
    setSendingConfirmation(request.id);
    
    try {
      const { error } = await supabase.functions.invoke("send-demo-confirmation", {
        body: {
          parentEmail: request.parent_email,
          parentName: request.parent_name,
          studentName: request.student_name,
          subject: request.subject,
          timing: request.timing,
          days: request.days,
        },
      });

      if (error) throw error;

      await supabase
        .from("demo_requests")
        .update({ status: "confirmed" })
        .eq("id", request.id);

      toast({
        title: "Confirmation sent!",
        description: `Email sent to ${request.parent_email}`,
      });

      fetchData();
    } catch (error: any) {
      console.error("Error sending confirmation:", error);
      toast({
        title: "Failed to send confirmation",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSendingConfirmation(null);
    }
  };

  const handleUpdateDemoStatus = async (requestId: string, newStatus: "approved" | "rejected" | "done") => {
    setUpdatingStatus(requestId);
    
    try {
      const { error } = await supabase
        .from("demo_requests")
        .update({ status: newStatus })
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: `Request ${newStatus}`,
        description: `Demo request has been ${newStatus}.`,
      });

      fetchData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteDemoRequest = async (requestId: string) => {
    setDeletingRequest(requestId);
    
    try {
      const { error } = await supabase
        .from("demo_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      toast({
        title: "Request deleted",
        description: "Demo request has been removed.",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error deleting request:", error);
      toast({
        title: "Failed to delete",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setDeletingRequest(null);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateTeacherSuccess(false);

    try {
      const validated = createTeacherSchema.parse(teacherForm);

      const { data, error } = await supabase.functions.invoke("create-teacher", {
        body: {
          email: validated.email,
          password: validated.password,
          fullName: validated.fullName,
          phone: validated.phone,
          subjects: validated.subjects,
          availability: validated.availability,
          bio: validated.bio,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCreateTeacherSuccess(true);
      toast({
        title: "Teacher created!",
        description: `Account created for ${validated.email}. Share the credentials with the teacher.`,
      });

      setTeacherForm({
        email: "",
        password: "",
        fullName: "",
        phone: "",
        subjects: "",
        availability: "",
        bio: "",
      });

      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating teacher",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateStudentSuccess(false);

    try {
      const validated = createStudentSchema.parse(studentForm);

      const { data, error } = await supabase.functions.invoke("create-student", {
        body: {
          email: validated.email,
          password: validated.password,
          studentName: validated.studentName,
          fullName: validated.fullName,
          phone: validated.phone,
          grade: validated.grade,
          assignedTeacherIds: validated.assignedTeacherIds,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCreateStudentSuccess(true);
      toast({
        title: "Student created!",
        description: `Account created for ${validated.email}. Share the credentials with the student/parent.`,
      });

      setStudentForm({
        email: "",
        password: "",
        studentName: "",
        fullName: "",
        phone: "",
        grade: "",
        assignedTeacherIds: [],
      });

      fetchData();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating student",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const teacherCount = profiles.filter(p => p.role === "teacher").length;
  const studentCount = profiles.filter(p => p.role === "student").length;
  const adminCount = profiles.filter(p => p.role === "admin").length;

  if (loading) {
    return (
      <DashboardLayout 
        title="Admin Dashboard" 
        roleLabel="Admin" 
        roleColor="admin"
        sidebarItems={adminSidebarItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-admin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      title="Admin Dashboard" 
      roleLabel="Admin" 
      roleColor="admin"
      sidebarItems={adminSidebarItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 dashboard-stagger-in">
        <StatCard icon={GraduationCap} label="Students" value={studentCount} variant="student" />
        <StatCard icon={Users} label="Teachers" value={teacherCount} variant="teacher" />
        <StatCard icon={Users} label="Admins" value={adminCount} variant="admin" />
        <StatCard icon={CalendarCheck} label="Demo Requests" value={demoRequests.length} variant="primary" />
      </div>

      {/* Tab Content */}
      <div className="dashboard-section">
        {activeTab === "demo-requests" && (
          <Card className="dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" />
                Demo Class Requests
              </CardTitle>
              <CardDescription>View and manage demo class requests from parents</CardDescription>
              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2 mt-4">
                {(["pending", "approved", "done", "all"] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={demoFilter === filter ? "default" : "outline"}
                    onClick={() => setDemoFilter(filter)}
                    className={demoFilter === filter ? "dashboard-btn dashboard-btn-admin" : ""}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    {filter !== "all" && (
                      <span className="ml-1.5 text-xs opacity-70">
                        ({demoRequests.filter(r => 
                          filter === "pending" ? (r.status === "sent" || r.status === "pending" || !r.status) :
                          r.status === filter
                        ).length})
                      </span>
                    )}
                    {filter === "all" && (
                      <span className="ml-1.5 text-xs opacity-70">({demoRequests.length})</span>
                    )}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const filteredRequests = demoRequests.filter(r => {
                  if (demoFilter === "all") return true;
                  if (demoFilter === "pending") return r.status === "sent" || r.status === "pending" || !r.status;
                  return r.status === demoFilter;
                });
                
                if (filteredRequests.length === 0) {
                  return (
                    <EmptyState 
                      icon={CalendarCheck}
                      title={demoFilter === "all" ? "No demo requests yet" : `No ${demoFilter} requests`}
                      description={demoFilter === "all" 
                        ? "When parents submit demo class requests, they'll appear here for you to manage."
                        : `There are no ${demoFilter} demo requests at this time.`
                      }
                    />
                  );
                }
                
                return (
                  <div className="space-y-4">
                    {filteredRequests.map((request) => (
                      <div key={request.id} className="border border-border rounded-xl p-4 hover:border-admin/30 transition-all hover:shadow-md bg-card">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg">{request.student_name}</h3>
                              <Badge 
                                variant={
                                  request.status === "approved" ? "default" : 
                                  request.status === "rejected" ? "destructive" :
                                  request.status === "done" ? "default" :
                                  request.status === "confirmed" ? "default" : "secondary"
                                }
                                className={
                                  request.status === "approved" ? "bg-success/10 text-success border-success/20" :
                                  request.status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                  request.status === "done" ? "bg-muted text-muted-foreground border-border" :
                                  request.status === "confirmed" ? "bg-primary/10 text-primary border-primary/20" :
                                  "bg-warning/10 text-warning border-warning/20"
                                }
                              >
                                {request.status === "approved" ? "Approved" : 
                                 request.status === "rejected" ? "Rejected" :
                                 request.status === "done" ? "Done" :
                                 request.status === "confirmed" ? "Confirmed" : "Pending"}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p><strong>Age:</strong> {request.age} | <strong>Grade:</strong> {request.grade}</p>
                              <p><strong>Subject:</strong> {request.subject}</p>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{request.timing} on {request.days}</span>
                              </div>
                            </div>
                            <div className="pt-2 border-t border-border/50 text-sm">
                              <p><strong>Parent:</strong> {request.parent_name}</p>
                              <div className="flex flex-wrap items-center gap-4 mt-1 text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {request.parent_email}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {request.phone}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Submitted: {new Date(request.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {request.status !== "approved" && request.status !== "rejected" && request.status !== "done" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  className="dashboard-btn dashboard-btn-admin"
                                  onClick={() => handleUpdateDemoStatus(request.id, "approved")}
                                  disabled={updatingStatus === request.id}
                                >
                                  {updatingStatus === request.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <><CheckCircle2 className="h-4 w-4 mr-1" />Approve</>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateDemoStatus(request.id, "rejected")}
                                  disabled={updatingStatus === request.id}
                                  className="text-destructive hover:bg-destructive/10 border-destructive/30"
                                >
                                  {updatingStatus === request.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <><XCircle className="h-4 w-4 mr-1" />Reject</>
                                  )}
                                </Button>
                              </div>
                            )}
                            
                            {request.status !== "done" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const subject = encodeURIComponent("Shobs Academy - Demo Class Request");
                                  const body = encodeURIComponent(
                                    `Hello ${request.parent_name},\n\nThanks for requesting a demo class for ${request.student_name}. We will contact you shortly.\n\nRegards,\nShobs Academy`
                                  );
                                  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(request.parent_email)}&su=${subject}&body=${body}`;
                                  const mailtoUrl = `mailto:${request.parent_email}?subject=${subject}&body=${body}`;
                                  
                                  const newWindow = window.open(gmailUrl, "_blank", "noopener,noreferrer");
                                  if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
                                    window.location.href = mailtoUrl;
                                  }
                                }}
                              >
                                <Mail className="h-4 w-4 mr-1" />Send Email
                              </Button>
                            )}
                            
                            {/* Done button */}
                            {request.status !== "done" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUpdateDemoStatus(request.id, "done")}
                                disabled={updatingStatus === request.id}
                                className="text-success hover:bg-success/10 border-success/30"
                              >
                                {updatingStatus === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <><Check className="h-4 w-4 mr-1" />Mark Done</>
                                )}
                              </Button>
                            )}
                            
                            {/* Delete button with confirmation */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10"
                                  disabled={deletingRequest === request.id}
                                >
                                  {deletingRequest === request.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <><Trash2 className="h-4 w-4 mr-1" />Delete</>
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete demo request?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the demo request from {request.parent_name} for {request.student_name}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteDemoRequest(request.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {activeTab === "create-teacher" && (
          <Card className="max-w-lg dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create Teacher Account
              </CardTitle>
              <CardDescription>
                Create a new teacher account. Share the credentials securely with the teacher.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {createTeacherSuccess && (
                <div className="mb-4 p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <p className="text-sm text-success">
                    Teacher account created successfully! Share the login credentials with the teacher.
                  </p>
                </div>
              )}
              <form onSubmit={handleCreateTeacher} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacher-email">Email *</Label>
                    <Input
                      id="teacher-email"
                      type="email"
                      placeholder="teacher@example.com"
                      value={teacherForm.email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher-password">Temporary Password *</Label>
                    <Input
                      id="teacher-password"
                      type="text"
                      placeholder="TempPass123!"
                      value={teacherForm.password}
                      onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacher-fullName">Full Name *</Label>
                    <Input
                      id="teacher-fullName"
                      placeholder="John Doe"
                      value={teacherForm.fullName}
                      onChange={(e) => setTeacherForm({ ...teacherForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher-phone">Phone</Label>
                    <Input
                      id="teacher-phone"
                      placeholder="+1 234 567 8900"
                      value={teacherForm.phone}
                      onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacher-subjects">Subjects</Label>
                    <Input
                      id="teacher-subjects"
                      placeholder="Math, Physics"
                      value={teacherForm.subjects}
                      onChange={(e) => setTeacherForm({ ...teacherForm, subjects: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacher-availability">Availability</Label>
                    <Input
                      id="teacher-availability"
                      placeholder="Mon-Fri 9am-5pm"
                      value={teacherForm.availability}
                      onChange={(e) => setTeacherForm({ ...teacherForm, availability: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher-bio">Bio</Label>
                  <Textarea
                    id="teacher-bio"
                    placeholder="Teacher's background and experience..."
                    value={teacherForm.bio}
                    onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full dashboard-btn dashboard-btn-admin" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                  ) : (
                    "Create Teacher Account"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === "create-student" && (
          <Card className="max-w-lg dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Create Student Account
              </CardTitle>
              <CardDescription>
                Create a new student account. Share the credentials securely with the student or parent.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {createStudentSuccess && (
                <div className="mb-4 p-4 rounded-lg bg-success/10 border border-success/20 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <p className="text-sm text-success">
                    Student account created successfully! Share the login credentials with the student/parent.
                  </p>
                </div>
              )}
              <form onSubmit={handleCreateStudent} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-email">Email *</Label>
                    <Input
                      id="student-email"
                      type="email"
                      placeholder="student@example.com"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-password">Temporary Password *</Label>
                    <Input
                      id="student-password"
                      type="text"
                      placeholder="TempPass123!"
                      value={studentForm.password}
                      onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-studentName">Student Name *</Label>
                    <Input
                      id="student-studentName"
                      placeholder="Student's display name"
                      value={studentForm.studentName}
                      onChange={(e) => setStudentForm({ ...studentForm, studentName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-fullName">Full Name</Label>
                    <Input
                      id="student-fullName"
                      placeholder="Full legal name"
                      value={studentForm.fullName}
                      onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-phone">Phone</Label>
                    <Input
                      id="student-phone"
                      placeholder="+1 234 567 8900"
                      value={studentForm.phone}
                      onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-grade">Grade</Label>
                    <Input
                      id="student-grade"
                      placeholder="10th Grade"
                      value={studentForm.grade}
                      onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}
                    />
                  </div>
                </div>
                <MultiTeacherAssign
                  teachers={profiles
                    .filter((p) => p.role === "teacher")
                    .map((t) => ({ user_id: t.user_id, full_name: t.full_name }))}
                  value={studentForm.assignedTeacherIds}
                  onChange={(ids) => setStudentForm({ ...studentForm, assignedTeacherIds: ids })}
                  idPrefix="student-teacher"
                />
                <Button type="submit" className="w-full dashboard-btn dashboard-btn-admin" disabled={submitting}>
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Creating...</>
                  ) : (
                    "Create Student Account"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeTab === "messages" && (
          <Tabs defaultValue="conversations" className="space-y-4">
            <TabsList>
              <TabsTrigger value="conversations">Conversations</TabsTrigger>
              <TabsTrigger value="teachers">Teacher Messages</TabsTrigger>
            </TabsList>
            <TabsContent value="conversations">
              <MessagingPanel userRole="admin" />
            </TabsContent>
            <TabsContent value="teachers">
              <AdminTeacherMessaging userRole="admin" />
            </TabsContent>
          </Tabs>
        )}

        {activeTab === "resources" && <TeacherResources />}
        {activeTab === "recordings" && <AdminRecordingSubmissions />}

        {activeTab === "all-users" && (
          <UserManagement profiles={profiles} onRefresh={fetchData} />
        )}

        {activeTab === "salary" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="dashboard-list-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Teacher Salary Calculator
                </CardTitle>
                <CardDescription>Calculate and send salary details to teachers</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendSalary} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Teacher *</Label>
                    <Select value={salaryForm.teacherId} onValueChange={(v) => setSalaryForm({ ...salaryForm, teacherId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a teacher" />
                      </SelectTrigger>
                      <SelectContent>
                        {teachers.map((t) => (
                          <SelectItem key={t.user_id} value={t.user_id}>
                            {t.full_name || t.user_id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Number of Classes</Label>
                      <Input
                        type="number"
                        placeholder="e.g., 20"
                        value={salaryForm.numClasses}
                        onChange={(e) => setSalaryForm({ ...salaryForm, numClasses: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Hours *</Label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="e.g., 40"
                        value={salaryForm.totalHours}
                        onChange={(e) => setSalaryForm({ ...salaryForm, totalHours: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Salary Per Hour *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 25.00"
                      value={salaryForm.salaryPerHour}
                      onChange={(e) => setSalaryForm({ ...salaryForm, salaryPerHour: e.target.value })}
                      required
                    />
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold text-admin">
                      ${((parseFloat(salaryForm.totalHours) || 0) * (parseFloat(salaryForm.salaryPerHour) || 0)).toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Note (optional)</Label>
                    <Textarea
                      placeholder="Any additional notes..."
                      value={salaryForm.note}
                      onChange={(e) => setSalaryForm({ ...salaryForm, note: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full dashboard-btn dashboard-btn-admin" disabled={!salaryForm.teacherId || submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send to Teacher"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            <Card className="dashboard-list-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Recent Salary Records
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teacherSalaries.length === 0 ? (
                  <EmptyState icon={DollarSign} title="No salary records" description="Salary records will appear here." />
                ) : (
                  <div className="space-y-3">
                    {teacherSalaries.map((s) => (
                      <div key={s.id} className="p-3 rounded-lg border border-border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{s.teacher_name || "Teacher"}</p>
                            <p className="text-sm text-muted-foreground">
                              {s.total_hours}h × ${s.salary_per_hour}/h = ${s.amount?.toFixed(2)}
                            </p>
                          </div>
                          <Badge className={
                            s.status === "confirmed" ? "bg-success/10 text-success" :
                            s.status === "needs_correction" ? "bg-destructive/10 text-destructive" :
                            "bg-warning/10 text-warning"
                          }>
                            {s.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "fee-sheet" && (
          <AttendanceBasedFeeCalculator />
        )}

        {activeTab === "families" && (
          <FamilyManagement />
        )}

        {activeTab === "work-submissions" && (
          <WorkSubmissions />
        )}

        {activeTab === "work-done" && (
          <AdminWorkDone />
        )}

        {activeTab === "fees" && (
          <Card className="dashboard-list-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Student Fees (Pending Review)
              </CardTitle>
              <CardDescription>Review fee details from teachers and forward to students</CardDescription>
            </CardHeader>
            <CardContent>
              {studentFees.length === 0 ? (
                <EmptyState icon={DollarSign} title="No pending fees" description="When teachers submit fee details, they'll appear here for review." />
              ) : (
                <div className="space-y-4">
                  {studentFees.map((fee) => (
                    <div key={fee.id} className="p-4 rounded-xl border border-border hover:border-admin/30 transition-all">
                      <div className="flex flex-wrap justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{fee.student_name || "Student"}</h4>
                            <Badge variant="outline">{fee.month}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">Teacher: {fee.teacher_name || "Unknown"}</p>
                          <p className="text-sm">
                            {fee.total_hours}h × ${fee.fee_per_hour}/h = <span className="font-semibold">${fee.total_amount?.toFixed(2)}</span>
                          </p>
                          {fee.subjects && <p className="text-xs text-muted-foreground">Subjects: {fee.subjects}</p>}
                          {fee.class_dates && <p className="text-xs text-muted-foreground">Dates: {fee.class_dates}</p>}
                        </div>
                        <Button onClick={() => handleMarkFeeViewed(fee)} className="dashboard-btn dashboard-btn-admin">
                          <Eye className="h-4 w-4 mr-1" />Viewed - Send to Student
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
