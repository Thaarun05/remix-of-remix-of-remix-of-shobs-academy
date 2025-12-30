import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { MessagingPanel } from "@/components/messaging/MessagingPanel";
import { StatCard } from "@/components/dashboard/StatCard";
import { adminSidebarItems } from "@/components/dashboard/DashboardSidebar";
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
  XCircle
} from "lucide-react";
import { z } from "zod";

interface Profile {
  user_id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
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

const AdminDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [sendingConfirmation, setSendingConfirmation] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("demo-requests");
  
  const [teacherForm, setTeacherForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    subjects: "",
    availability: "",
    bio: "",
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [profilesRes, demoRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, role, full_name, phone, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("demo_requests")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

      setProfiles(profilesRes.data || []);
      setDemoRequests(demoRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
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

  const handleUpdateDemoStatus = async (requestId: string, newStatus: "approved" | "rejected") => {
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

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateSuccess(false);

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

      setCreateSuccess(true);
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
            </CardHeader>
            <CardContent>
              {demoRequests.length === 0 ? (
                <EmptyState 
                  icon={CalendarCheck}
                  title="No demo requests yet"
                  description="When parents submit demo class requests, they'll appear here for you to manage."
                />
              ) : (
                <div className="space-y-4">
                  {demoRequests.map((request) => (
                    <div key={request.id} className="border border-border rounded-xl p-4 hover:border-admin/30 transition-all hover:shadow-md bg-card">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{request.student_name}</h3>
                            <Badge 
                              variant={
                                request.status === "approved" ? "default" : 
                                request.status === "rejected" ? "destructive" :
                                request.status === "confirmed" ? "default" : "secondary"
                              }
                              className={
                                request.status === "approved" ? "bg-success/10 text-success border-success/20" :
                                request.status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/20" :
                                request.status === "confirmed" ? "bg-primary/10 text-primary border-primary/20" :
                                "bg-warning/10 text-warning border-warning/20"
                              }
                            >
                              {request.status === "approved" ? "Approved" : 
                               request.status === "rejected" ? "Rejected" :
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
                          {request.status !== "approved" && request.status !== "rejected" && (
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendConfirmation(request)}
                            disabled={sendingConfirmation === request.id}
                          >
                            {sendingConfirmation === request.id ? (
                              <><Loader2 className="h-4 w-4 animate-spin mr-1" />Sending...</>
                            ) : (
                              <><Mail className="h-4 w-4 mr-1" />{request.status === "confirmed" ? "Resend" : "Send"} Email</>
                            )}
                          </Button>
                          <a 
                            href={`mailto:${request.parent_email}`}
                            className="text-xs text-center text-muted-foreground hover:text-foreground"
                          >
                            Open in email client
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              {createSuccess && (
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
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="teacher@example.com"
                      value={teacherForm.email}
                      onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Temporary Password *</Label>
                    <Input
                      id="password"
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
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="John Doe"
                      value={teacherForm.fullName}
                      onChange={(e) => setTeacherForm({ ...teacherForm, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      placeholder="+1 234 567 8900"
                      value={teacherForm.phone}
                      onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="subjects">Subjects</Label>
                    <Input
                      id="subjects"
                      placeholder="Math, Physics"
                      value={teacherForm.subjects}
                      onChange={(e) => setTeacherForm({ ...teacherForm, subjects: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="availability">Availability</Label>
                    <Input
                      id="availability"
                      placeholder="Mon-Fri 9am-5pm"
                      value={teacherForm.availability}
                      onChange={(e) => setTeacherForm({ ...teacherForm, availability: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
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

        {activeTab === "messages" && (
          <MessagingPanel userRole="admin" />
        )}

        {activeTab === "all-users" && (
          <Card className="dashboard-list-card">
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View all registered users in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <EmptyState 
                  icon={Users}
                  title="No users registered yet"
                  description="When students and teachers sign up, they'll appear here."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="dashboard-table dashboard-table-admin">
                    <thead>
                      <tr>
                        <th>Role</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((profile) => (
                        <tr key={profile.user_id}>
                          <td>
                            <Badge className={
                              profile.role === "student" ? "bg-student/10 text-student border-student/20" :
                              profile.role === "teacher" ? "bg-teacher/10 text-teacher border-teacher/20" :
                              "bg-admin/10 text-admin border-admin/20"
                            }>
                              {profile.role}
                            </Badge>
                          </td>
                          <td>{profile.full_name || "-"}</td>
                          <td className="text-muted-foreground">{profile.phone || "-"}</td>
                          <td className="text-muted-foreground">
                            {new Date(profile.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
