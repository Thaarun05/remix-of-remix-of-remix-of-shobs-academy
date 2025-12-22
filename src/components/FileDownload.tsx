import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, File, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileInfo {
  file_name: string;
  storage_path: string;
  uploaded_by_role: "teacher" | "student";
  uploaded_at: string;
}

interface FileDownloadProps {
  files: FileInfo[];
  title?: string;
  compact?: boolean;
}

export function FileDownload({ files, title, compact = false }: FileDownloadProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (file: FileInfo) => {
    setDownloading(file.storage_path);

    try {
      const { data, error } = await supabase.storage
        .from("assignment-files")
        .createSignedUrl(file.storage_path, 60); // 60 seconds expiry

      if (error) throw error;

      // Open in new tab or trigger download
      window.open(data.signedUrl, "_blank");

      toast({
        title: "Download started",
        description: `Downloading ${file.file_name}`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Download failed";
      toast({
        title: "Download failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  if (files.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <Button
            key={index}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDownload(file)}
            disabled={downloading === file.storage_path}
            className="text-xs"
          >
            {downloading === file.storage_path ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Download className="h-3 w-3 mr-1" />
            )}
            {file.file_name}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && (
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
      )}
      <div className="space-y-1">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
          >
            <File className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{file.file_name}</p>
              <p className="text-xs text-muted-foreground">
                Uploaded by {file.uploaded_by_role} • {new Date(file.uploaded_at).toLocaleDateString()}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(file)}
              disabled={downloading === file.storage_path}
            >
              {downloading === file.storage_path ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Separate component for viewing submissions (for teachers)
interface SubmissionFilesProps {
  submissionFiles: FileInfo[];
  studentName?: string;
}

export function SubmissionFiles({ submissionFiles, studentName }: SubmissionFilesProps) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (file: FileInfo) => {
    setDownloading(file.storage_path);

    try {
      const { data, error } = await supabase.storage
        .from("assignment-files")
        .createSignedUrl(file.storage_path, 60);

      if (error) throw error;

      window.open(data.signedUrl, "_blank");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Download failed";
      toast({
        title: "Download failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  if (submissionFiles.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No submissions uploaded</p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {studentName ? `${studentName}'s Submission` : "Student Submission"}
      </p>
      <div className="space-y-1">
        {submissionFiles.map((file, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-2 rounded-md bg-student/5 border border-student/10"
          >
            <File className="h-4 w-4 text-student shrink-0" />
            <span className="flex-1 text-sm truncate">{file.file_name}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(file)}
              disabled={downloading === file.storage_path}
              className="text-student hover:text-student"
            >
              {downloading === file.storage_path ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
