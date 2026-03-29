import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Whiteboard } from "@/components/teacher/Whiteboard";
import { PenTool, Loader2, Calendar, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface WhiteboardShare {
  id: string;
  whiteboard_id: string;
  teacher_user_id: string;
  title: string;
  thumbnail_data: string | null;
  sent_at: string;
}

export function StudentWhiteboards() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<WhiteboardShare[]>([]);
  const [activeSession, setActiveSession] = useState<{ sessionId: string; title: string } | null>(null);

  useEffect(() => {
    if (user) fetchSharedBoards();
  }, [user]);

  const fetchSharedBoards = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("whiteboard_shares" as any)
        .select("id, whiteboard_id, teacher_user_id, title, thumbnail_data, sent_at")
        .eq("student_user_id", user.id)
        .is("deleted_at", null)
        .order("sent_at", { ascending: false });

      setBoards((data as unknown as WhiteboardShare[]) || []);
    } catch (error) {
      console.error("Error fetching shared whiteboards:", error);
    } finally {
      setLoading(false);
    }
  };

  const openWhiteboard = async (board: WhiteboardShare) => {
    if (!user) return;
    try {
      // Find existing session
      const { data: existing } = await supabase
        .from("whiteboard_sessions" as any)
        .select("id")
        .eq("whiteboard_id", board.whiteboard_id)
        .eq("student_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      let sessionId: string;

      if (existing) {
        sessionId = (existing as any).id;
      } else {
        // Create a new session — use the share's teacher_user_id
        const { data: newSession, error } = await supabase
          .from("whiteboard_sessions" as any)
          .insert({
            whiteboard_id: board.whiteboard_id,
            teacher_user_id: board.teacher_user_id,
            student_user_id: user.id,
            canvas_state: JSON.stringify({ strokes: [], shapes: [], texts: [], stickyNotes: [], tables: [], images: [] }),
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        sessionId = (newSession as any)?.id;
      }

      if (sessionId) {
        setActiveSession({ sessionId, title: board.title });
      }
    } catch (err) {
      console.error("Error opening whiteboard session:", err);
    }
  };

  // Show full interactive whiteboard
  if (activeSession) {
    return (
      <div className="h-[calc(100vh-120px)]">
        <Whiteboard
          mode="student"
          sessionId={activeSession.sessionId}
          onBack={() => setActiveSession(null)}
        />
      </div>
    );
  }

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
        <CardDescription>Whiteboards shared by your teacher — click to open and collaborate live</CardDescription>
      </CardHeader>
      <CardContent>
        {boards.length === 0 ? (
          <EmptyState
            icon={PenTool}
            title="No whiteboards shared yet"
            description="When your teacher shares a whiteboard, it will appear here."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="group rounded-xl border border-border bg-card hover:border-student/40 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                onClick={() => openWhiteboard(board)}
              >
                {board.thumbnail_data ? (
                  <div className="w-full h-32 bg-white border-b border-border">
                    <img src={board.thumbnail_data} alt={board.title} className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-muted flex items-center justify-center border-b border-border">
                    <PenTool className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm truncate">{board.title}</p>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(board.sent_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                  <p className="text-xs text-student font-medium mt-1.5">Click to open & draw together</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
