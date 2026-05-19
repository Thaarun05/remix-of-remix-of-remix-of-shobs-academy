import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardList, Loader2, CheckCircle2, Trash2, RotateCcw } from "lucide-react";

interface Row {
  id: string;
  teacher_user_id: string;
  work_date: string;
  submitted_at: string;
  status: string;
  teacher_name?: string;
}

interface EntryRow {
  id: string;
  student_user_id: string;
  start_time: string | null;
  end_time: string | null;
  topic: string | null;
  student_name?: string;
}

export function WorkSubmissions() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [detailEntries, setDetailEntries] = useState<EntryRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: subs, error } = await supabase
      .from("teacher_work_submissions")
      .select("id, teacher_user_id, work_date, submitted_at, status")
      .order("submitted_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const list = ((subs || []) as unknown) as Row[];
    const ids = Array.from(new Set(list.map(r => r.teacher_user_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach(r => { r.teacher_name = map.get(r.teacher_user_id) || "Unknown"; });
    }
    setRows(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    const { error } = await supabase
      .from("teacher_work_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to approve", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Approved" });
    load();
  };

  const revert = async (id: string) => {
    const { error } = await supabase
      .from("teacher_work_submissions")
      .update({ status: "pending", reviewed_at: null } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Reverted to pending" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this submission?")) return;
    const { error } = await supabase
      .from("teacher_work_submissions")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Submission deleted" });
    load();
  };

  const openDetail = async (row: Row) => {
    setDetailRow(row);
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailEntries([]);
    const { data, error } = await supabase
      .from("attendance_records")
      .select("id, student_user_id, start_time, end_time, topic")
      .eq("teacher_user_id", row.teacher_user_id)
      .eq("date", row.work_date)
      .is("deleted_at", null);
    if (error) {
      toast({ title: "Failed to load entries", description: error.message, variant: "destructive" });
      setDetailLoading(false);
      return;
    }
    const list = ((data || []) as unknown) as EntryRow[];
    const ids = Array.from(new Set(list.map(e => e.student_user_id)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("student_profiles")
        .select("user_id, student_name")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.student_name]));
      list.forEach(e => { e.student_name = map.get(e.student_user_id) || "Unknown"; });
    }
    setDetailEntries(list);
    setDetailLoading(false);
  };

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" /> Teacher Work Submissions
        </CardTitle>
        <CardDescription>Review and approve monthly work logs from teachers</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No submissions yet" description="Teacher work log submissions will appear here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teacher</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => openDetail(r)}
                >
                  <TableCell className="font-medium">{r.teacher_name}</TableCell>
                  <TableCell>{r.work_date}</TableCell>
                  <TableCell>{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {r.status !== "approved" ? (
                        <Button size="sm" onClick={() => approve(r.id)}>
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => revert(r.id)}>
                          <RotateCcw className="h-4 w-4" /> Edit
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Entries for {detailRow?.work_date}
            </DialogTitle>
            <DialogDescription>
              {detailRow?.teacher_name}'s logged classes for this day
            </DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : detailEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No entries logged for this day.</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {detailEntries.map(e => (
                <div key={e.id} className="p-3 rounded-lg border bg-card">
                  <div className="font-medium">{e.student_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {e.start_time || "--"} – {e.end_time || "--"}{e.topic ? ` · ${e.topic}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}