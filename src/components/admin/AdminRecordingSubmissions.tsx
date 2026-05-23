import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { Film, Loader2, ExternalLink, CheckCircle2 } from "lucide-react";

interface Row {
  id: string;
  teacher_id: string;
  teacher_name: string | null;
  title: string;
  recording_url: string;
  class_date: string | null;
  topic: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  admin_viewed_at: string | null;
}

export function AdminRecordingSubmissions() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_recording_submissions" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setRows((data as unknown as Row[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleMarkReviewed = async (id: string) => {
    const { error } = await supabase
      .from("teacher_recording_submissions" as any)
      .update({ status: "reviewed", admin_viewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Marked reviewed" });
    load();
  };

  const filtered = rows.filter(r => tab === "pending" ? r.status === "sent_to_admin" : r.status === "reviewed");

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Film className="h-5 w-5" /> Recorded Class Submissions</CardTitle>
        <CardDescription>Review recording links submitted by teachers</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          </TabsList>
          <TabsContent value={tab}>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Film} title={tab === "pending" ? "No pending recordings" : "No reviewed recordings"} description="Submissions from teachers will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Class Date</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.teacher_name || "Unknown"}</TableCell>
                      <TableCell>{r.title}</TableCell>
                      <TableCell>{r.class_date || "—"}</TableCell>
                      <TableCell>{r.topic || "—"}</TableCell>
                      <TableCell>
                        <a href={r.recording_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={r.status === "reviewed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                          {r.status === "reviewed" ? "Reviewed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status !== "reviewed" && (
                          <Button size="sm" onClick={() => handleMarkReviewed(r.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Reviewed
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}