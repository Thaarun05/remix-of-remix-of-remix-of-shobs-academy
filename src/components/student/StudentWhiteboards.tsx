import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PenTool, Loader2, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface SharedBoard {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  entity_id: string | null;
  share_token?: string | null;
}

export function StudentWhiteboards() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<SharedBoard[]>([]);

  useEffect(() => {
    if (user) fetchSharedBoards();
  }, [user]);

  const fetchSharedBoards = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get whiteboard notifications for this student
      const { data: notifications } = await supabase
        .from("notifications")
        .select("id, title, body, created_at, entity_id")
        .eq("recipient_id", user.id)
        .eq("type", "whiteboard_shared")
        .order("created_at", { ascending: false });

      if (!notifications || notifications.length === 0) {
        setBoards([]);
        setLoading(false);
        return;
      }

      // Get the whiteboard share tokens for each entity_id
      const entityIds = notifications
        .map((n) => n.entity_id)
        .filter(Boolean) as string[];

      if (entityIds.length > 0) {
        const { data: whiteboards } = await (supabase.from("whiteboards" as any))
          .select("id, share_token")
          .in("id", entityIds)
          .is("deleted_at", null);

        const tokenMap = new Map(
          ((whiteboards as any[]) || []).map((w: any) => [w.id, w.share_token])
        );

        setBoards(
          notifications.map((n) => ({
            ...n,
            share_token: n.entity_id ? tokenMap.get(n.entity_id) || null : null,
          }))
        );
      } else {
        setBoards(notifications.map((n) => ({ ...n, share_token: null })));
      }
    } catch (error) {
      console.error("Error fetching shared whiteboards:", error);
    } finally {
      setLoading(false);
    }
  };

  const openWhiteboard = (shareToken: string) => {
    window.open(`${window.location.origin}/whiteboard?token=${shareToken}`, "_blank");
  };

  if (loading) {
    return (
      <Card className="dashboard-list-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-student" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dashboard-list-card">
      <CardHeader>
        <CardTitle>Shared Whiteboards</CardTitle>
        <CardDescription>Whiteboards shared by your teacher during lessons</CardDescription>
      </CardHeader>
      <CardContent>
        {boards.length === 0 ? (
          <EmptyState
            icon={PenTool}
            title="No whiteboards shared yet"
            description="When your teacher shares a whiteboard, it will appear here."
          />
        ) : (
          <div className="space-y-3">
            {boards.map((board) => (
              <div
                key={board.id}
                className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-student/10 flex items-center justify-center">
                    <PenTool className="h-5 w-5 text-student" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{board.body || board.title}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(board.created_at!), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>
                </div>
                {board.share_token && (
                  <Button
                    variant="student"
                    size="sm"
                    onClick={() => openWhiteboard(board.share_token!)}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
