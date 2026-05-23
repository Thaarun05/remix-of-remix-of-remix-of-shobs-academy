import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { FileDownload, SubmissionFiles } from "@/components/FileDownload";
import { CheckCircle2, ClipboardList, Clock, Eye, FileText, GraduationCap, Trash2 } from "lucide-react";
import type { TabContext } from "./types";

export default function ManageAssignmentsTab({ ctx }: { ctx: TabContext }) {
  const {
    students, assignments, manageFilterStudent, setManageFilterStudent,
    manageFilterSubject, setManageFilterSubject,
    handleMarkAssignmentViewed, handleSoftDelete, isOverdue,
  } = ctx;

  const filtered = assignments.filter(a => {
    if (manageFilterStudent !== "all" && a.student_user_id !== manageFilterStudent) return false;
    if (manageFilterSubject !== "all" && a.subject !== manageFilterSubject) return false;
    return true;
  });

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          All Assignments
        </CardTitle>
        <CardDescription>
          <div className="flex flex-wrap gap-2 mt-2">
            <Select value={manageFilterStudent} onValueChange={setManageFilterStudent}>
              <SelectTrigger className="w-[180px] h-8 bg-background"><SelectValue placeholder="All Students" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">All Students</SelectItem>
                {students.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.student_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={manageFilterSubject} onValueChange={setManageFilterSubject}>
              <SelectTrigger className="w-[180px] h-8 bg-background"><SelectValue placeholder="All Subjects" /></SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">All Subjects</SelectItem>
                {[...new Set(assignments.map(a => a.subject).filter(Boolean))].map(s => (
                  <SelectItem key={s!} value={s!}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No assignments found" description="No assignments match the selected filters." />
        ) : (
          <div className="space-y-4">
            {filtered.map((assignment) => (
              <div key={assignment.id} className="p-4 rounded-xl border border-border hover:border-teacher/30 transition-all hover:shadow-md bg-card">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground">{assignment.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {assignment.student_name}
                      </Badge>
                      {assignment.subject && (
                        <Badge variant="outline" className="text-xs">
                          {assignment.subject}
                        </Badge>
                      )}
                    </div>
                    {assignment.description && <p className="text-sm text-muted-foreground mt-1">{assignment.description}</p>}
                    {assignment.due_date && (
                      <span className={`text-xs flex items-center gap-1 mt-2 ${isOverdue(assignment.due_date) && assignment.status !== "submitted" ? "text-destructive" : "text-muted-foreground"}`}>
                        <Clock className="h-3 w-3" />
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {assignment.status === "submitted" ? (
                      <>
                        <Badge className="bg-success/10 text-success border-success/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Submitted
                        </Badge>
                        <Button size="sm" className="dashboard-btn dashboard-btn-teacher" onClick={() => handleMarkAssignmentViewed(assignment.id, assignment.student_user_id)}>
                          <Eye className="h-4 w-4 mr-1" />Mark Viewed
                        </Button>
                      </>
                    ) : assignment.status === "viewed" ? (
                      <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                        <Eye className="h-3 w-3 mr-1" />Viewed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5">Pending</Badge>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleSoftDelete("assignments", assignment.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {assignment.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <FileDownload files={assignment.attachments} title="Your Attachments" />
                  </div>
                )}

                {assignment.submission_attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <SubmissionFiles submissionFiles={assignment.submission_attachments} studentName={assignment.student_name} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
