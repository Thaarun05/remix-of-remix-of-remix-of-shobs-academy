import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { MultiTeacherAssign } from "@/components/admin/MultiTeacherAssign";
import { 
  Users, 
  UserPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

interface Profile {
  user_id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

interface TeacherProfile {
  user_id: string;
  subjects: string | null;
  availability: string | null;
  bio: string | null;
}

interface StudentProfile {
  user_id: string;
  student_name: string;
  grade: string | null;
  assigned_teacher_id: string | null;
}

interface UserManagementProps {
  profiles: Profile[];
  onRefresh: () => void;
}

export function UserManagement({ profiles, onRefresh }: UserManagementProps) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addUserType, setAddUserType] = useState<"student" | "teacher">("student");
  
  // Extended profile data for editing
  const [teacherProfileData, setTeacherProfileData] = useState<TeacherProfile | null>(null);
  const [studentProfileData, setStudentProfileData] = useState<StudentProfile | null>(null);

  // Edit form for teachers
  const [editTeacherForm, setEditTeacherForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    subjects: "",
    availability: "",
    bio: "",
  });

  // Edit form for students
  const [editStudentForm, setEditStudentForm] = useState({
    email: "",
    password: "",
    studentName: "",
    fullName: "",
    phone: "",
    grade: "",
    assignedTeacherIds: [] as string[],
    disabled: false,
  });

  const [addTeacherForm, setAddTeacherForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    subjects: "",
    availability: "",
    bio: "",
  });

  const [addStudentForm, setAddStudentForm] = useState({
    email: "",
    password: "",
    studentName: "",
    fullName: "",
    phone: "",
    grade: "",
    assignedTeacherIds: [] as string[],
  });

  const teachers = profiles.filter(p => p.role === "teacher");

  const fetchUserEmail = async (userId: string): Promise<string> => {
    // We can't directly fetch email from auth.users, so we'll leave it empty
    // The admin can update it if needed
    return "";
  };

  const fetchTeacherProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("teacher_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!error && data) {
      setTeacherProfileData(data);
      return data;
    }
    return null;
  };

  const fetchStudentProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (!error && data) {
      setStudentProfileData(data);
      return data;
    }
    return null;
  };

  const handleEditClick = async (profile: Profile) => {
    setEditingUser(profile);
    
    if (profile.role === "teacher") {
      const teacherData = await fetchTeacherProfile(profile.user_id);
      setEditTeacherForm({
        email: "",
        password: "",
        fullName: profile.full_name || "",
        phone: profile.phone || "",
        subjects: teacherData?.subjects || "",
        availability: teacherData?.availability || "",
        bio: teacherData?.bio || "",
      });
    } else if (profile.role === "student") {
      const studentData = await fetchStudentProfile(profile.user_id);
      // Load all teacher assignments from join table
      const { data: assignments } = await supabase
        .from("student_teacher_assignments")
        .select("teacher_user_id, created_at")
        .eq("student_user_id", profile.user_id)
        .order("created_at", { ascending: true });
      let teacherIds: string[] = (assignments || []).map((r: any) => r.teacher_user_id);
      if (teacherIds.length === 0 && studentData?.assigned_teacher_id) {
        teacherIds = [studentData.assigned_teacher_id];
      }
      setEditStudentForm({
        email: "",
        password: "",
        studentName: studentData?.student_name || "",
        fullName: profile.full_name || "",
        phone: profile.phone || "",
        grade: studentData?.grade || "",
        assignedTeacherIds: teacherIds,
        disabled: false,
      });
      // Fetch current disabled state via update-user (no-op call)
      supabase.functions
        .invoke("update-user", { body: { userId: profile.user_id } })
        .then(({ data }) => {
          if (data?.disabled === true) {
            setEditStudentForm((f) => ({ ...f, disabled: true }));
          }
        })
        .catch(() => {});
    }
    
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (profile: Profile) => {
    setDeletingUser(profile);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: deletingUser.user_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "User deleted",
        description: `${deletingUser.full_name || "User"} has been deleted successfully.`,
      });

      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error deleting user",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTeacherEdit = async () => {
    if (!editingUser) return;
    setSubmitting(true);

    try {
      const updatePayload: any = {
        userId: editingUser.user_id,
        fullName: editTeacherForm.fullName,
        phone: editTeacherForm.phone,
        subjects: editTeacherForm.subjects,
        availability: editTeacherForm.availability,
        bio: editTeacherForm.bio,
      };

      // Only include email/password if provided
      if (editTeacherForm.email) updatePayload.email = editTeacherForm.email;
      if (editTeacherForm.password) updatePayload.password = editTeacherForm.password;

      const { data, error } = await supabase.functions.invoke("update-user", {
        body: updatePayload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Teacher updated",
        description: "Teacher profile has been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error updating teacher",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveStudentEdit = async () => {
    if (!editingUser) return;
    setSubmitting(true);

    try {
      const updatePayload: any = {
        userId: editingUser.user_id,
        fullName: editStudentForm.fullName,
        phone: editStudentForm.phone,
        studentName: editStudentForm.studentName,
        grade: editStudentForm.grade,
        assignedTeacherIds: editStudentForm.assignedTeacherIds,
        disabled: editStudentForm.disabled,
      };

      // Only include email/password if provided
      if (editStudentForm.email) updatePayload.email = editStudentForm.email;
      if (editStudentForm.password) updatePayload.password = editStudentForm.password;

      const { data, error } = await supabase.functions.invoke("update-user", {
        body: updatePayload,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Student updated",
        description: "Student profile has been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error updating student",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTeacher = async () => {
    setSubmitting(true);

    try {
      if (!addTeacherForm.email || !addTeacherForm.password || !addTeacherForm.fullName) {
        throw new Error("Email, password, and full name are required");
      }

      const { data, error } = await supabase.functions.invoke("create-teacher", {
        body: {
          email: addTeacherForm.email,
          password: addTeacherForm.password,
          fullName: addTeacherForm.fullName,
          phone: addTeacherForm.phone,
          subjects: addTeacherForm.subjects,
          availability: addTeacherForm.availability,
          bio: addTeacherForm.bio,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Teacher created!",
        description: `Account created for ${addTeacherForm.email}.`,
      });

      setAddTeacherForm({
        email: "",
        password: "",
        fullName: "",
        phone: "",
        subjects: "",
        availability: "",
        bio: "",
      });
      setIsAddDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error creating teacher",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddStudent = async () => {
    setSubmitting(true);

    try {
      if (!addStudentForm.email || !addStudentForm.password || !addStudentForm.studentName) {
        throw new Error("Email, password, and student name are required");
      }

      if (!addStudentForm.assignedTeacherIds || addStudentForm.assignedTeacherIds.length === 0) {
        throw new Error("Please assign a teacher");
      }

      const { data, error } = await supabase.functions.invoke("create-student", {
        body: {
          email: addStudentForm.email,
          password: addStudentForm.password,
          studentName: addStudentForm.studentName,
          fullName: addStudentForm.fullName,
          phone: addStudentForm.phone,
          grade: addStudentForm.grade,
          assignedTeacherIds: addStudentForm.assignedTeacherIds,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Student created!",
        description: `Account created for ${addStudentForm.email}.`,
      });

      setAddStudentForm({
        email: "",
        password: "",
        studentName: "",
        fullName: "",
        phone: "",
        grade: "",
        assignedTeacherIds: [],
      });
      setIsAddDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error creating student",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Card className="dashboard-list-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Users</CardTitle>
            <CardDescription>View and manage all registered users</CardDescription>
          </div>
          <Button 
            onClick={() => setIsAddDialogOpen(true)} 
            className="dashboard-btn dashboard-btn-admin"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <EmptyState 
              icon={Users}
              title="No users registered yet"
              description="When students and teachers are created, they'll appear here."
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
                    <th className="text-right">Actions</th>
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
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {profile.role !== "admin" && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditClick(profile)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteClick(profile)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Teacher Dialog */}
      <Dialog open={isEditDialogOpen && editingUser?.role === "teacher"} onOpenChange={(open) => !open && setIsEditDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update all details for {editingUser?.full_name || "this teacher"}. Leave email/password blank to keep unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-email">Email</Label>
                <Input
                  id="edit-teacher-email"
                  type="email"
                  placeholder="Leave blank to keep unchanged"
                  value={editTeacherForm.email}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-password">New Password</Label>
                <Input
                  id="edit-teacher-password"
                  type="text"
                  placeholder="Leave blank to keep unchanged"
                  value={editTeacherForm.password}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-fullName">Full Name *</Label>
                <Input
                  id="edit-teacher-fullName"
                  placeholder="John Doe"
                  value={editTeacherForm.fullName}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-phone">Phone</Label>
                <Input
                  id="edit-teacher-phone"
                  placeholder="+1 234 567 8900"
                  value={editTeacherForm.phone}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-subjects">Subjects</Label>
                <Input
                  id="edit-teacher-subjects"
                  placeholder="Math, Physics"
                  value={editTeacherForm.subjects}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, subjects: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-teacher-availability">Availability</Label>
                <Input
                  id="edit-teacher-availability"
                  placeholder="Mon-Fri 9am-5pm"
                  value={editTeacherForm.availability}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, availability: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-teacher-bio">Bio</Label>
              <Textarea
                id="edit-teacher-bio"
                placeholder="Teacher's background and experience..."
                value={editTeacherForm.bio}
                onChange={(e) => setEditTeacherForm({ ...editTeacherForm, bio: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTeacherEdit} 
              className="dashboard-btn dashboard-btn-admin"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen && editingUser?.role === "student"} onOpenChange={(open) => !open && setIsEditDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update all details for {editingUser?.full_name || "this student"}. Leave email/password blank to keep unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-student-email">Email</Label>
                <Input
                  id="edit-student-email"
                  type="email"
                  placeholder="Leave blank to keep unchanged"
                  value={editStudentForm.email}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-student-password">New Password</Label>
                <Input
                  id="edit-student-password"
                  type="text"
                  placeholder="Leave blank to keep unchanged"
                  value={editStudentForm.password}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, password: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-student-studentName">Student Name *</Label>
                <Input
                  id="edit-student-studentName"
                  placeholder="Student's display name"
                  value={editStudentForm.studentName}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, studentName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-student-fullName">Full Name</Label>
                <Input
                  id="edit-student-fullName"
                  placeholder="Full legal name"
                  value={editStudentForm.fullName}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, fullName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-student-phone">Phone</Label>
                <Input
                  id="edit-student-phone"
                  placeholder="+1 234 567 8900"
                  value={editStudentForm.phone}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-student-grade">Grade</Label>
                <Input
                  id="edit-student-grade"
                  placeholder="10th Grade"
                  value={editStudentForm.grade}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, grade: e.target.value })}
                />
              </div>
            </div>
            <MultiTeacherAssign
              teachers={teachers}
              value={editStudentForm.assignedTeacherIds}
              onChange={(ids) => setEditStudentForm({ ...editStudentForm, assignedTeacherIds: ids })}
              idPrefix="edit-student-teacher"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveStudentEdit} 
              className="dashboard-btn dashboard-btn-admin"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingUser?.full_name || "this user"}? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new student or teacher account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>User Type</Label>
              <Select 
                value={addUserType} 
                onValueChange={(v: "student" | "teacher") => setAddUserType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addUserType === "teacher" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-teacher-email">Email *</Label>
                    <Input
                      id="add-teacher-email"
                      type="email"
                      placeholder="teacher@example.com"
                      value={addTeacherForm.email}
                      onChange={(e) => setAddTeacherForm({ ...addTeacherForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-teacher-password">Temporary Password *</Label>
                    <Input
                      id="add-teacher-password"
                      type="text"
                      placeholder="TempPass123!"
                      value={addTeacherForm.password}
                      onChange={(e) => setAddTeacherForm({ ...addTeacherForm, password: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-teacher-fullName">Full Name *</Label>
                    <Input
                      id="add-teacher-fullName"
                      placeholder="John Doe"
                      value={addTeacherForm.fullName}
                      onChange={(e) => setAddTeacherForm({ ...addTeacherForm, fullName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-teacher-phone">Phone</Label>
                    <Input
                      id="add-teacher-phone"
                      placeholder="+1 234 567 8900"
                      value={addTeacherForm.phone}
                      onChange={(e) => setAddTeacherForm({ ...addTeacherForm, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-teacher-subjects">Subjects</Label>
                    <Input
                      id="add-teacher-subjects"
                      placeholder="Math, Physics"
                      value={addTeacherForm.subjects}
                      onChange={(e) => setAddTeacherForm({ ...addTeacherForm, subjects: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-teacher-availability">Availability</Label>
                    <Input
                      id="add-teacher-availability"
                      placeholder="Mon-Fri 9am-5pm"
                      value={addTeacherForm.availability}
                      onChange={(e) => setAddTeacherForm({ ...addTeacherForm, availability: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-teacher-bio">Bio</Label>
                  <Textarea
                    id="add-teacher-bio"
                    placeholder="Teacher's background and experience..."
                    value={addTeacherForm.bio}
                    onChange={(e) => setAddTeacherForm({ ...addTeacherForm, bio: e.target.value })}
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-student-email">Email *</Label>
                    <Input
                      id="add-student-email"
                      type="email"
                      placeholder="student@example.com"
                      value={addStudentForm.email}
                      onChange={(e) => setAddStudentForm({ ...addStudentForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-student-password">Temporary Password *</Label>
                    <Input
                      id="add-student-password"
                      type="text"
                      placeholder="TempPass123!"
                      value={addStudentForm.password}
                      onChange={(e) => setAddStudentForm({ ...addStudentForm, password: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-student-studentName">Student Name *</Label>
                    <Input
                      id="add-student-studentName"
                      placeholder="Student's display name"
                      value={addStudentForm.studentName}
                      onChange={(e) => setAddStudentForm({ ...addStudentForm, studentName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-student-fullName">Full Name</Label>
                    <Input
                      id="add-student-fullName"
                      placeholder="Full legal name"
                      value={addStudentForm.fullName}
                      onChange={(e) => setAddStudentForm({ ...addStudentForm, fullName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-student-phone">Phone</Label>
                    <Input
                      id="add-student-phone"
                      placeholder="+1 234 567 8900"
                      value={addStudentForm.phone}
                      onChange={(e) => setAddStudentForm({ ...addStudentForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-student-grade">Grade</Label>
                    <Input
                      id="add-student-grade"
                      placeholder="10th Grade"
                      value={addStudentForm.grade}
                      onChange={(e) => setAddStudentForm({ ...addStudentForm, grade: e.target.value })}
                    />
                  </div>
                </div>
                <MultiTeacherAssign
                  teachers={teachers}
                  value={addStudentForm.assignedTeacherIds}
                  onChange={(ids) => setAddStudentForm({ ...addStudentForm, assignedTeacherIds: ids })}
                  idPrefix="add-student-teacher"
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addUserType === "teacher" ? handleAddTeacher : handleAddStudent} 
              className="dashboard-btn dashboard-btn-admin"
              disabled={submitting}
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create {addUserType === "teacher" ? "Teacher" : "Student"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
