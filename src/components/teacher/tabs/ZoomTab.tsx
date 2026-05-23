import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Loader2, Pencil, Plus, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { TabContext } from "./types";

export default function ZoomTab({ ctx }: { ctx: TabContext }) {
  const {
    students, meetLinks, selectedStudent, setSelectedStudent,
    meetForm, setMeetForm, submitting, setSubmitting, fetchData,
    openEditMeet, openDeleteDialog,
  } = ctx;
  const { user } = useAuth();
  const { toast } = useToast();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {selectedStudent ? "Create / Update Zoom Link" : "Create New Zoom Link"}
          </CardTitle>
          <CardDescription>
            {selectedStudent
              ? `Setting Zoom link for: ${students.find(s => s.user_id === selectedStudent)?.student_name || "Selected Student"}`
              : "Select a student above to create or update their Zoom link"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedStudent ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <Video className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-2">No student selected</p>
              <p className="text-sm text-muted-foreground">Use the student selector above to choose a student</p>
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedStudent || !meetForm.zoomLink || !user) return;
              setSubmitting(true);
              try {
                const { error } = await supabase.from("meet_links").upsert({
                  student_user_id: selectedStudent,
                  teacher_user_id: user.id,
                  zoom_link: meetForm.zoomLink,
                  class_label: meetForm.classLabel || null,
                  deleted_at: null,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "student_user_id,teacher_user_id" });
                if (error) throw error;
                toast({ title: "Success", description: "Zoom link saved!" });
                setMeetForm({ ...meetForm, zoomLink: "", classLabel: "" });
                fetchData();
              } catch (error: unknown) {
                toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to save link", variant: "destructive" });
              } finally {
                setSubmitting(false);
              }
            }} className="space-y-4">
              <div className="p-3 bg-teacher/10 rounded-lg border border-teacher/20 mb-4">
                <p className="text-sm font-medium text-teacher">
                  Creating link for: {students.find(s => s.user_id === selectedStudent)?.student_name}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="classLabel">Class Label</Label>
                <Input
                  id="classLabel"
                  placeholder="e.g. Mathematics, Science"
                  value={meetForm.classLabel}
                  onChange={(e) => setMeetForm({ ...meetForm, classLabel: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zoomLink">Zoom URL *</Label>
                <Input
                  id="zoomLink"
                  type="url"
                  placeholder="https://zoom.us/j/xxxxxxxxx"
                  value={meetForm.zoomLink}
                  onChange={(e) => setMeetForm({ ...meetForm, zoomLink: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Save Zoom Link
                  </>
                )}
              </Button>
            </form>
          )}

          {students.filter(s => !meetLinks.some(z => z.student_user_id === s.user_id && z.zoom_link)).length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm font-medium mb-3">Students without your Zoom link:</p>
              <div className="space-y-2">
                {students
                  .filter(s => !meetLinks.some(z => z.student_user_id === s.user_id && z.zoom_link))
                  .sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""))
                  .map(student => (
                    <div key={student.user_id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <span className="text-sm">{student.student_name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => setSelectedStudent(student.user_id)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add Link
                      </Button>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="dashboard-list-card h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Video className="h-4 w-4" />
            Active Zoom Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
          {meetLinks.filter(link => students.some(s => s.user_id === link.student_user_id) && link.zoom_link).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No Zoom links set for your students</p>
          ) : (
            meetLinks
              .filter(link => students.some(s => s.user_id === link.student_user_id) && link.zoom_link)
              .sort((a, b) => (a.student_name || "").localeCompare(b.student_name || ""))
              .map((link) => (
                <div key={link.student_user_id} className="p-4 rounded-xl border border-border hover:border-teacher/30 transition-all hover:shadow-md bg-card">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{link.student_name}</p>
                      <p className="text-xs text-muted-foreground break-all mt-1">{link.zoom_link}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Button
                      size="sm"
                      className="dashboard-btn dashboard-btn-teacher shrink-0"
                      onClick={() => window.open(link.zoom_link!, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Join Zoom
                    </Button>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/50">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => openEditMeet(link)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => openDeleteDialog("meet_links", `${link.student_user_id}|${link.teacher_user_id}`, `${link.student_name}'s Zoom link`)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
