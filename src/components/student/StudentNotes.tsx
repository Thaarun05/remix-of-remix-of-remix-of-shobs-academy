import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Loader2,
  File,
  FileText,
  Image,
  Video,
  FileSpreadsheet,
  Download,
  ExternalLink,
} from "lucide-react";
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
  teacher_user_id: string;
}

export function StudentNotes() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState<string>("");
  const [filterSubject, setFilterSubject] = useState("all");

  useEffect(() => {
    fetchNotes();
  }, [user]);

  const fetchNotes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get assigned teacher
      const { data: studentProfile } = await supabase
        .from("student_profiles")
        .select("assigned_teacher_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!studentProfile?.assigned_teacher_id) {
        setLoading(false);
        return;
      }

      // Get teacher name
      const { data: teacherProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", studentProfile.assigned_teacher_id)
        .maybeSingle();

      setTeacherName(teacherProfile?.full_name || "Your Teacher");

      // Get notes from assigned teacher
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("teacher_user_id", studentProfile.assigned_teacher_id)
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
    return true;
  });

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-student" />
          📚 Notes from {teacherName}
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
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-student" /></div>
        ) : filteredNotes.length === 0 ? (
          <EmptyState icon={BookOpen} title="No notes available" description="Your teacher hasn't uploaded any notes yet." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotes.map((note) => (
                  <TableRow key={note.id}>
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
                    <TableCell>{note.grade || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openFile(note)}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
