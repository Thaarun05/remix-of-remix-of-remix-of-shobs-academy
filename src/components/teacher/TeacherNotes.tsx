import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Upload,
  Loader2,
  File,
  X,
  Trash2,
  Pencil,
  FileText,
  Image,
  Video,
  FileSpreadsheet,
  ExternalLink,
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SUBJECTS = ["Math", "Science", "English", "Social Studies", "Hindi", "Computer Science", "Physics", "Chemistry", "Biology", "Other"];
const GRADES = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

interface Note {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  file_name: string;
  file_type: string | null;
  storage_path: string;
  file_size: number | null;
  created_at: string;
  student_user_id: string | null;
}

interface AssignedStudent {
  user_id: string;
  student_name: string;
}

export function TeacherNotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [form, setForm] = useState({ title: "", subject: "", grade: "", studentId: "" });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editForm, setEditForm] = useState({ title: "", subject: "", grade: "" });

  const [filterSubject, setFilterSubject] = useState("all");
  const [filterStudent, setFilterStudent] = useState("all");
  const [assignedStudents, setAssignedStudents] = useState<AssignedStudent[]>([]);

  useEffect(() => {
    fetchNotes();
    fetchAssignedStudents();
  }, [user]);

  const fetchAssignedStudents = async () => {
    if (!user) return;
    // Primary mapping via assigned_teacher_id
    const { data: primary } = await supabase
      .from("student_profiles")
      .select("user_id, student_name")
      .eq("assigned_teacher_id", user.id);

    // Additional mapping via multi-teacher junction table
    const { data: links } = await supabase
      .from("student_teacher_assignments")
      .select("student_user_id")
      .eq("teacher_user_id", user.id);

    const extraIds = (links || [])
      .map((l: any) => l.student_user_id)
      .filter((id: string) => !(primary || []).some((p: any) => p.user_id === id));

    let extra: AssignedStudent[] = [];
    if (extraIds.length) {
      const { data } = await supabase
        .from("student_profiles")
        .select("user_id, student_name")
        .in("user_id", extraIds);
      extra = data || [];
    }

    const merged = [...(primary || []), ...extra].sort((a, b) =>
      a.student_name.localeCompare(b.student_name)
    );
    setAssignedStudents(merged);
  };

  const fetchNotes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("teacher_user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 50MB.", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedFile || !form.title.trim()) return;

    setSubmitting(true);
    setUploading(true);
    setUploadProgress(10);

    try {
      const timestamp = Date.now();
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${user.id}/${timestamp}_${safeName}`;

      setUploadProgress(30);

      const { error: uploadError } = await supabase.storage
        .from("note-files")
        .upload(storagePath, selectedFile);

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      setUploadProgress(70);

      const { error: insertError } = await supabase.from("notes").insert({
        teacher_user_id: user.id,
        title: form.title.trim(),
        subject: form.subject || null,
        grade: form.grade || null,
        file_name: selectedFile.name,
        file_type: selectedFile.type || null,
        storage_path: storagePath,
        file_size: selectedFile.size,
        student_user_id: form.studentId || null,
      });

      if (insertError) throw insertError;

      setUploadProgress(100);

      // Send notification only to the selected student
      if (form.studentId) {
        await supabase.from("notifications").insert({
          recipient_id: form.studentId,
          sender_id: user.id,
          type: "note_uploaded",
          title: "📚 New Note Uploaded",
          body: `Your teacher uploaded "${form.title.trim()}"${form.subject ? ` for ${form.subject}` : ""}.`,
          role_target: "student",
          entity_table: "notes",
        });
      }

      toast({ title: "Note uploaded", description: `"${form.title}" uploaded successfully.` });
      setForm({ title: "", subject: "", grade: "", studentId: "" });
      setSelectedFile(null);
      fetchNotes();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!deletingNote) return;
    try {
      await supabase.storage.from("note-files").remove([deletingNote.storage_path]);
      const { error } = await supabase
        .from("notes")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deletingNote.id);
      if (error) throw error;
      toast({ title: "Note deleted" });
      setDeleteDialogOpen(false);
      setDeletingNote(null);
      fetchNotes();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Delete failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleEdit = async () => {
    if (!editingNote) return;
    try {
      const { error } = await supabase
        .from("notes")
        .update({
          title: editForm.title.trim(),
          subject: editForm.subject || null,
          grade: editForm.grade || null,
        })
        .eq("id", editingNote.id);
      if (error) throw error;
      toast({ title: "Note updated" });
      setEditDialogOpen(false);
      setEditingNote(null);
      fetchNotes();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Update failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const openFile = async (note: Note) => {
    try {
      const { data, error } = await supabase.storage
        .from("note-files")
        .createSignedUrl(note.storage_path, 3600);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Could not open file";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const getFileIcon = (type: string | null) => {
    if (!type) return <File className="h-4 w-4" />;
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-green-500" />;
    if (type.startsWith("video/")) return <Video className="h-4 w-4 text-purple-500" />;
    if (type.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
    if (type.includes("spreadsheet") || type.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredNotes = notes.filter(n => {
    if (filterSubject !== "all" && n.subject !== filterSubject) return false;
    if (filterStudent !== "all") {
      const student = assignedStudents.find(s => s.student_name === filterStudent);
      if (student && n.student_user_id !== student.user_id) return false;
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Upload Form */}
      <Card className="dashboard-list-card lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-teacher" />
            Upload Note
          </CardTitle>
          <CardDescription>Share study materials with your students</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Chapter 5 - Fractions"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grade</Label>
              <Select value={form.grade} onValueChange={(v) => setForm({ ...form, grade: v })}>
                <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  {GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select value={form.studentId} onValueChange={(v) => setForm({ ...form, studentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {assignedStudents.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File *</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.mp4,.avi,.mov,.jpg,.jpeg,.png,.gif,.webp"
                />
              </div>
              {selectedFile && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                  {getFileIcon(selectedFile.type)}
                  <span className="flex-1 truncate">{selectedFile.name}</span>
                  <span className="text-xs text-muted-foreground">{formatSize(selectedFile.size)}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedFile(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            {uploading && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
              </div>
            )}
            <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={submitting || !form.title.trim() || !selectedFile || !form.studentId}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <>
                <Upload className="h-4 w-4 mr-2" />Upload Note
              </>}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card className="dashboard-list-card lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teacher" />
            My Uploaded Notes
          </CardTitle>
          <CardDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-[140px] h-8"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStudent} onValueChange={setFilterStudent}>
                <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Student" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {assignedStudents.map(s => <SelectItem key={s.user_id} value={s.student_name}>{s.student_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-teacher" /></div>
          ) : filteredNotes.length === 0 ? (
            <EmptyState icon={BookOpen} title="No notes uploaded" description="Upload study materials for your students." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNotes.map((note) => (
                    <TableRow key={note.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openFile(note)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFileIcon(note.file_type)}
                          <div>
                            <p className="font-medium">{note.title}</p>
                            <p className="text-xs text-muted-foreground">{note.file_name} · {formatSize(note.file_size)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{note.subject ? <Badge variant="outline">{note.subject}</Badge> : "—"}</TableCell>
                      <TableCell>
                        {(() => {
                          const student = assignedStudents.find(s => s.user_id === (note as any).student_user_id);
                          return student ? <Badge variant="secondary" className="text-xs">{student.student_name}</Badge> : <span className="text-xs text-muted-foreground">—</span>;
                        })()}
                      </TableCell>
                      <TableCell>{note.grade || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditingNote(note);
                            setEditForm({ title: note.title, subject: note.subject || "", grade: note.grade || "" });
                            setEditDialogOpen(true);
                          }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                            setDeletingNote(note);
                            setDeleteDialogOpen(true);
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>Update title, subject, or grade.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={editForm.subject} onValueChange={(v) => setEditForm({ ...editForm, subject: v })}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grade</Label>
              <Select value={editForm.grade} onValueChange={(v) => setEditForm({ ...editForm, grade: v })}>
                <SelectTrigger><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>{GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editForm.title.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingNote?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the note and its file. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingNote(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
