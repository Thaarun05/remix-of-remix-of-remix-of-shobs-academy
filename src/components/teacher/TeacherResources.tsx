import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  FolderOpen,
  Upload,
  Loader2,
  File as FileIcon,
  X,
  Trash2,
  Download,
  FileText,
  Presentation,
  FileType,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
  class_label?: string | null;
  subject?: string | null;
  uploader_name?: string;
}

const MAX_SIZE = 50 * 1024 * 1024;

const ALLOWED_EXTS = ["pdf", "ppt", "pptx", "doc", "docx"];
const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const CLASS_OPTIONS = Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`);
const SUBJECT_OPTIONS = [
  "Math",
  "Science",
  "English",
  "Social Studies",
  "Hindi",
  "Computer Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Other",
];

function getKind(fileName: string, fileType: string): "pdf" | "ppt" | "doc" | "other" {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || fileType.includes("pdf")) return "pdf";
  if (ext === "ppt" || ext === "pptx" || fileType.includes("presentation") || fileType.includes("powerpoint")) return "ppt";
  if (ext === "doc" || ext === "docx" || fileType.includes("word")) return "doc";
  return "other";
}

function KindBadge({ fileName, fileType }: { fileName: string; fileType: string }) {
  const kind = getKind(fileName, fileType);
  const map = {
    pdf: { label: "PDF", cls: "bg-red-500/15 text-red-600 border-red-500/30", Icon: FileText },
    ppt: { label: "PPT", cls: "bg-orange-500/15 text-orange-600 border-orange-500/30", Icon: Presentation },
    doc: { label: "DOC", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30", Icon: FileType },
    other: { label: "FILE", cls: "bg-muted text-muted-foreground border-border", Icon: FileIcon },
  } as const;
  const { label, cls, Icon } = map[kind];
  return (
    <Badge variant="outline" className={cls}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function TeacherResources() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [allTeachers, setAllTeachers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: "", description: "", class_label: "", subject: "" });
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Resource | null>(null);

  const canAccess = role === "teacher" || role === "admin";
  const canUpload = role === "teacher";

  useEffect(() => {
    if (canAccess) {
      fetchResources();
      fetchTeachers();
    }
  }, [user, role]);

  const fetchTeachers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("role", "teacher");
    const list = (data || [])
      .map((p: any) => ({ id: p.user_id, name: p.full_name || "Unnamed" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setAllTeachers(list);
  };

  const fetchResources = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("teacher_resources")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list: Resource[] = data || [];

      const uploaderIds = Array.from(new Set(list.map((r) => r.uploaded_by)));
      if (uploaderIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", uploaderIds);
        const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
        list.forEach((r) => {
          r.uploader_name = nameMap.get(r.uploaded_by) || "Unknown";
        });
      }
      setResources(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load resources";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SIZE) return "Maximum file size is 50MB.";
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTS.includes(ext)) return "Only PDF, PPT, PPTX, DOC, DOCX files are allowed.";
    if (file.type && !ALLOWED_MIMES.includes(file.type)) {
      // Some browsers report empty mime; only block if mime is set and unsupported
      return "File type not allowed.";
    }
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const err = validateFile(file);
      if (err) {
        toast({ title: "Invalid file", description: err, variant: "destructive" });
      } else {
        setSelectedFile(file);
      }
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

      const { error: upErr } = await supabase.storage
        .from("teacher-resources")
        .upload(storagePath, selectedFile);
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      setUploadProgress(75);

      const { error: insErr } = await (supabase as any).from("teacher_resources").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        class_label: form.class_label.trim() || null,
        subject: form.subject.trim() || null,
        file_name: selectedFile.name,
        file_type: selectedFile.type || "",
        file_size: selectedFile.size,
        storage_path: storagePath,
        uploaded_by: user.id,
      });
      if (insErr) throw insErr;

      setUploadProgress(100);
      toast({ title: "Resource uploaded", description: `"${form.title}" is now in the library.` });
      setForm({ title: "", description: "", class_label: "", subject: "" });
      setSelectedFile(null);
      fetchResources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownload = async (r: Resource) => {
    try {
      const { data, error } = await supabase.storage
        .from("teacher-resources")
        .createSignedUrl(r.storage_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Download failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await (supabase as any)
        .from("teacher_resources")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Resource removed" });
      setDeleteDialogOpen(false);
      setDeleting(null);
      fetchResources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  const teacherOptions = allTeachers;

  const classOptions = CLASS_OPTIONS;
  const subjectOptions = SUBJECT_OPTIONS;

  const filtered = resources.filter((r) => {
    if (filterTeacher !== "all" && r.uploaded_by !== filterTeacher) return false;
    if (filterClass !== "all" && (r.class_label || "").trim() !== filterClass) return false;
    if (filterSubject !== "all" && (r.subject || "").trim() !== filterSubject) return false;
    return true;
  });

  if (!canAccess) {
    return (
      <Card className="dashboard-list-card">
        <CardContent className="py-12">
          <EmptyState icon={FolderOpen} title="Access restricted" description="Only teachers and admins can view the resources library." />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {canUpload && (
        <Card className="dashboard-list-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-teacher" />
              Upload Resource
            </CardTitle>
            <CardDescription>Share PDFs, slides, and docs with all teachers</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  placeholder="e.g. Algebra Practice Set"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Optional notes about this resource"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={1000}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Input
                    placeholder="e.g. Grade 8"
                    value={form.class_label}
                    onChange={(e) => setForm({ ...form, class_label: e.target.value })}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input
                    placeholder="e.g. Math"
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>File * (PDF, PPT, DOC — max 50MB)</Label>
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
                    accept=".pdf,.ppt,.pptx,.doc,.docx"
                  />
                </div>
                {selectedFile && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    <KindBadge fileName={selectedFile.name} fileType={selectedFile.type} />
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
              <Button
                type="submit"
                className="w-full dashboard-btn dashboard-btn-teacher"
                disabled={submitting || !form.title.trim() || !selectedFile}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />Upload Resource
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className={`dashboard-list-card ${canUpload ? "lg:col-span-2" : "lg:col-span-3"}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-teacher" />
            Resources Library
          </CardTitle>
          <CardDescription>
            <div className="flex flex-wrap gap-2 mt-2">
              <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder="Teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {teacherOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-[160px] h-8">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teacher" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={FolderOpen} title="No resources yet" description="Uploaded resources will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Uploaded by</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{r.title}</p>
                          {r.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                          )}
                          {(r.class_label || r.subject) && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.class_label && (
                                <Badge variant="outline" className="text-[10px] py-0">{r.class_label}</Badge>
                              )}
                              {r.subject && (
                                <Badge variant="outline" className="text-[10px] py-0">{r.subject}</Badge>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {r.file_name} · {formatSize(r.file_size)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <KindBadge fileName={r.file_name} fileType={r.file_type} />
                      </TableCell>
                      <TableCell className="text-sm">{r.uploader_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(r)} title="Download">
                            <Download className="h-4 w-4" />
                          </Button>
                          {user?.id === r.uploaded_by && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleting(r);
                                setDeleteDialogOpen(true);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this resource?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" will no longer be visible to other teachers. This action can be reversed by an admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
