import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { ClipboardList, Loader2, CheckCircle2 } from "lucide-react";

interface Row {
  id: string;
  teacher_user_id: string;
  work_date: string;
  submitted_at: string;
  status: string;
  teacher_name?: string;
}

export function WorkSubmissions() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

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
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.teacher_name}</TableCell>
                  <TableCell>{r.work_date}</TableCell>
                  <TableCell>{new Date(r.submitted_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status !== "approved" && (
                      <Button size="sm" onClick={() => approve(r.id)}>
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}