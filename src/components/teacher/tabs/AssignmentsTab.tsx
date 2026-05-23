import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { File, Loader2, Plus, Upload, X } from "lucide-react";
import type { TabContext } from "./types";

export default function AssignmentsTab({ ctx }: { ctx: TabContext }) {
  const {
    assignmentForm, setAssignmentForm, handleAddAssignment, submitting, selectedStudent,
    fileInputRef, handleFileSelect, pendingFiles, removePendingFile, uploading, uploadProgress,
  } = ctx;

  return (
    <Card className="max-w-lg dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Create Assignment
        </CardTitle>
        <CardDescription>Assign work to the selected student with file attachments</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddAssignment} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Assignment title"
              value={assignmentForm.title}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g., Mathematics"
                value={assignmentForm.subject}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={assignmentForm.dueDate}
                onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Assignment details..."
              value={assignmentForm.description}
              onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Attachments
            </Label>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
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
              <span className="text-xs text-muted-foreground">PDF, DOC, images, etc.</span>
            </div>

            {uploading && (
              <div className="space-y-1">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
              </div>
            )}

            {pendingFiles.length > 0 && (
              <div className="space-y-2">
                {pendingFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 text-sm">
                    <File className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePendingFile(index)} disabled={uploading}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={!selectedStudent || submitting || uploading}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create Assignment {pendingFiles.length > 0 && `(${pendingFiles.length} files)`}</>}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
