import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  GraduationCap,
  UserPlus,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { z } from "zod";

interface Profile {
  user_id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
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
  const [submitting, setSubmitting] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  
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
    fetchProfiles();
  }, [user]);

  const fetchProfiles = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, role, full_name, phone, created_at")
        .order("created_at", { ascending: false });

      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateSuccess(false);

    try {
      const validated = createTeacherSchema.parse(teacherForm);

      // Call edge function to create teacher
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

      // Refresh profiles list
      fetchProfiles();
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
      <DashboardLayout title="Admin Dashboard" roleLabel="Admin" roleColor="admin">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-admin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard" roleLabel="Admin" roleColor="admin">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-student/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-student" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Students</p>
                <p className="text-2xl font-bold text-foreground">{studentCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-teacher/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-teacher" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Teachers</p>
                <p className="text-2xl font-bold text-foreground">{teacherCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-admin/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-admin" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-foreground">{adminCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="create-teacher" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="create-teacher" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Create Teacher
          </TabsTrigger>
          <TabsTrigger value="all-users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            All Users
          </TabsTrigger>
        </TabsList>

        {/* Create Teacher Tab */}
        <TabsContent value="create-teacher">
          <Card className="max-w-lg">
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
                <div className="mb-4 p-4 rounded-lg bg-teacher/10 border border-teacher/20 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-teacher" />
                  <p className="text-sm text-teacher">
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
                <Button
                  type="submit"
                  variant="admin"
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Teacher Account"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Users Tab */}
        <TabsContent value="all-users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View all registered users in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No users registered yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Phone</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((profile) => (
                        <tr key={profile.user_id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                          <td className="py-3 px-4">
                            <Badge className={
                              profile.role === "student" ? "role-badge-student" :
                              profile.role === "teacher" ? "role-badge-teacher" :
                              "role-badge-admin"
                            }>
                              {profile.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm">{profile.full_name || "-"}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{profile.phone || "-"}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
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
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminDashboard;
