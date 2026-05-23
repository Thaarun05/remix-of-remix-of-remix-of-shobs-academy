import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/EmptyState";
import { Film, Send, Loader2, ExternalLink } from "lucide-react";

interface Submission {
  id: string;
  title: string;
  recording_url: string;
  class_date: string | null;
  topic: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

const isValidUrl = (s: string) => {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
};

export function TeacherRecordings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ recording_url: "", title: "", class_date: "", topic: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("teacher_recording_submissions" as any)
      .select("id, title, recording_url, class_date, topic, notes, status, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    } else {
      setItems((data as unknown as Submission[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!isValidUrl(form.recording_url)) {
      toast({ title: "Invalid URL", description: "Please enter a valid http(s) link.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("user_id", user.id).single();

      const { error } = await supabase.from("teacher_recording_submissions" as any).insert({
        teacher_id: user.id,
        teacher_name: profile?.full_name || null,
        recording_url: form.recording_url.trim(),
        title: form.title.trim(),
        class_date: form.class_date || null,
        topic: form.topic.trim() || null,
        notes: form.notes.trim() || null,
        status: "sent_to_admin",
      });
      if (error) throw error;

      const { data: admins } = await supabase.from("profiles").select("user_id").eq("role", "admin");
      if (admins) {
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            recipient_id: admin.user_id,
            sender_id: user.id,
            type: "recording",
            title: "New class recording submitted",
            body: `${profile?.full_name || "A teacher"} submitted a recording: ${form.title}`,
            entity_table: "teacher_recording_submissions",
          });
        }
      }

      toast({ title: "Submitted", description: "Recording sent to admin for review." });
      setForm({ recording_url: "", title: "", class_date: "", topic: "", notes: "" });
      load();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="dashboard-list-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Film className="h-5 w-5" /> Submit Recorded Class</CardTitle>
          <CardDescription>Paste a Zoom, Google Drive, or YouTube link to share with admin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Recording URL *</Label>
              <Input type="url" placeholder="https://..." value={form.recording_url} onChange={(e) => setForm({ ...form, recording_url: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="e.g., Algebra P1 Week 3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class Date</Label>
                <Input type="date" value={form.class_date} onChange={(e) => setForm({ ...form, class_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Topic</Label>
                <Input placeholder="e.g., Quadratics" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} maxLength={200} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Optional notes for admin" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} maxLength={1000} />
            </div>
            <Button type="submit" className="w-full dashboard-btn dashboard-btn-teacher" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Submit to Admin</>}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="dashboard-list-card h-fit">
        <CardHeader><CardTitle className="text-base">My Submissions</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Film} title="No recordings submitted" description="Submitted recordings will appear here." />
          ) : (
            items.map((it) => (
              <div key={it.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{it.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.class_date || new Date(it.created_at).toLocaleDateString()}
                    {it.topic ? ` • ${it.topic}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={it.status === "reviewed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                    {it.status === "reviewed" ? "Reviewed" : "Sent"}
                  </Badge>
                  <a href={it.recording_url} target="_blank" rel="noopener noreferrer">
                    <Button size="icon" variant="ghost" className="h-7 w-7"><ExternalLink className="h-4 w-4" /></Button>
                  </a>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}