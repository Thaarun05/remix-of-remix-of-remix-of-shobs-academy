import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Upload, File, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FileInfo {
  file_name: string;
  storage_path: string;
  uploaded_by_role: "teacher" | "student";
  uploaded_at: string;
}

interface FileUploadProps {
  assignmentId?: string;
  studentUserId?: string;
  uploadType: "assignment" | "submission";
  role: "teacher" | "student";
  existingFiles?: FileInfo[];
  onFilesChange: (files: FileInfo[]) => void;
  disabled?: boolean;
}

export function FileUpload({
  assignmentId,
  studentUserId,
  uploadType,
  role,
  existingFiles = [],
  onFilesChange,
  disabled = false,
}: FileUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeUploadedFile = async (fileInfo: FileInfo) => {
    try {
      const { error } = await supabase.storage
        .from("assignment-files")
        .remove([fileInfo.storage_path]);

      if (error) throw error;

      const updatedFiles = existingFiles.filter(
        (f) => f.storage_path !== fileInfo.storage_path
      );
      onFilesChange(updatedFiles);

      toast({
        title: "File removed",
        description: `${fileInfo.file_name} has been deleted.`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete file";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const uploadFiles = async (): Promise<FileInfo[]> => {
    if (pendingFiles.length === 0) return existingFiles;
    if (!assignmentId) {
      toast({
        title: "Error",
        description: "Cannot upload files without an assignment ID.",
        variant: "destructive",
      });
      return existingFiles;
    }

    setUploading(true);
    setUploadProgress(0);

    const uploadedFiles: FileInfo[] = [...existingFiles];
    const totalFiles = pendingFiles.length;

    try {
      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");

        let storagePath: string;
        if (uploadType === "assignment") {
          storagePath = `assignments/${assignmentId}/${timestamp}_${safeName}`;
        } else {
          storagePath = `submissions/${assignmentId}/${studentUserId}/${timestamp}_${safeName}`;
        }

        const { error: uploadError } = await supabase.storage
          .from("assignment-files")
          .upload(storagePath, file);

        if (uploadError) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        uploadedFiles.push({
          file_name: file.name,
          storage_path: storagePath,
          uploaded_by_role: role,
          uploaded_at: new Date().toISOString(),
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      setPendingFiles([]);
      onFilesChange(uploadedFiles);

      toast({
        title: "Files uploaded",
        description: `${totalFiles} file(s) uploaded successfully.`,
      });

      return uploadedFiles;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
      return existingFiles;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Expose uploadFiles for parent components
  (FileUpload as any).uploadFiles = uploadFiles;

  return (
    <div className="space-y-3">
      {/* File Input */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          Add Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp"
        />
        {pendingFiles.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={uploadFiles}
            disabled={uploading || !assignmentId}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>Upload {pendingFiles.length} file(s)</>
            )}
          </Button>
        )}
      </div>

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-1">
          <Progress value={uploadProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
        </div>
      )}

      {/* Pending Files */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Pending uploads:</p>
          {pendingFiles.map((file, index) => (
            <div
              key={`pending-${index}`}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm"
            >
              <File className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => removePendingFile(index)}
                disabled={uploading}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Uploaded files:</p>
          {existingFiles.map((file, index) => (
            <div
              key={`uploaded-${index}`}
              className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/10 text-sm"
            >
              <File className="h-4 w-4 text-primary" />
              <span className="flex-1 truncate">{file.file_name}</span>
              <span className="text-xs text-muted-foreground">
                {file.uploaded_by_role}
              </span>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={() => removeUploadedFile(file)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook for file upload functionality
export function useFileUpload() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const addFiles = (files: File[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setPendingFiles([]);
  };

  const uploadFilesToStorage = async (
    assignmentId: string,
    uploadType: "assignment" | "submission",
    role: "teacher" | "student",
    studentUserId?: string
  ): Promise<FileInfo[]> => {
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

        let storagePath: string;
        if (uploadType === "assignment") {
          storagePath = `assignments/${assignmentId}/${timestamp}_${safeName}`;
        } else {
          storagePath = `submissions/${assignmentId}/${studentUserId}/${timestamp}_${safeName}`;
        }

        const { error: uploadError } = await supabase.storage
          .from("assignment-files")
          .upload(storagePath, file);

        if (uploadError) {
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
        }

        uploadedFiles.push({
          file_name: file.name,
          storage_path: storagePath,
          uploaded_by_role: role,
          uploaded_at: new Date().toISOString(),
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      setPendingFiles([]);
      return uploadedFiles;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return {
    pendingFiles,
    uploading,
    uploadProgress,
    addFiles,
    removeFile,
    clearFiles,
    uploadFilesToStorage,
  };
}

export type { FileInfo };
