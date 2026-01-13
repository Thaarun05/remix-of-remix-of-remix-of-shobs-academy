import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { 
  Users, 
  UserPlus,
  Loader2,
  Pencil,
  Plus,
  Phone,
} from "lucide-react";

interface Profile {
  user_id: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

interface UserManagementProps {
  profiles: Profile[];
  onRefresh: () => void;
}

export function UserManagement({ profiles, onRefresh }: UserManagementProps) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [addUserType, setAddUserType] = useState<"student" | "teacher">("student");

  const [editForm, setEditForm] = useState({
    fullName: "",
    phone: "",
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
    assignedTeacherId: "",
  });

  const teachers = profiles.filter(p => p.role === "teacher");

  const handleEditClick = (profile: Profile) => {
    setEditingUser(profile);
    setEditForm({
      fullName: profile.full_name || "",
      phone: profile.phone || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSubmitting(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.fullName || null,
          phone: editForm.phone || null,
        })
        .eq("user_id", editingUser.user_id);

      if (error) throw error;

      toast({
        title: "User updated",
        description: "User profile has been updated successfully.",
      });

      setIsEditDialogOpen(false);
      setEditingUser(null);
      onRefresh();
    } catch (error: any) {
      toast({
        title: "Error updating user",
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

      if (!addStudentForm.assignedTeacherId) {
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
          assignedTeacherId: addStudentForm.assignedTeacherId,
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
        assignedTeacherId: "",
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
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditClick(profile)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user profile information for {editingUser?.full_name || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Full Name</Label>
              <Input
                id="edit-fullName"
                placeholder="Enter full name"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                placeholder="+1 234 567 8900"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              className="dashboard-btn dashboard-btn-admin"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    <Label htmlFor="add-teacher-password">Password *</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="add-teacher-subjects">Subjects</Label>
                  <Input
                    id="add-teacher-subjects"
                    placeholder="Math, Science, English"
                    value={addTeacherForm.subjects}
                    onChange={(e) => setAddTeacherForm({ ...addTeacherForm, subjects: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-teacher-availability">Availability</Label>
                  <Input
                    id="add-teacher-availability"
                    placeholder="Mon-Fri 9AM-5PM"
                    value={addTeacherForm.availability}
                    onChange={(e) => setAddTeacherForm({ ...addTeacherForm, availability: e.target.value })}
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
                    <Label htmlFor="add-student-password">Password *</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="add-student-teacher">Assign Teacher *</Label>
                  <Select
                    value={addStudentForm.assignedTeacherId}
                    onValueChange={(value) => setAddStudentForm({ ...addStudentForm, assignedTeacherId: value })}
                  >
                    <SelectTrigger id="add-student-teacher">
                      <SelectValue placeholder="Select a teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.user_id} value={teacher.user_id}>
                          {teacher.full_name || "Unnamed Teacher"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
