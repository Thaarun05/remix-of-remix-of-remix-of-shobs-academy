import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PenTool, Loader2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface WhiteboardShare {
  id: string;
  whiteboard_id: string;
  title: string;
  thumbnail_data: string | null;
  sent_at: string;
}

export function StudentWhiteboards() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<WhiteboardShare[]>([]);
  const [viewImage, setViewImage] = useState<{ title: string; thumbnail: string } | null>(null);

  useEffect(() => {
    if (user) fetchSharedBoards();
  }, [user]);

  const fetchSharedBoards = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("whiteboard_shares" as any)
        .select("id, whiteboard_id, title, thumbnail_data, sent_at")
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
    <>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className="group rounded-xl border border-border bg-card hover:border-student/40 hover:shadow-md transition-all cursor-pointer overflow-hidden"
                  onClick={() => board.thumbnail_data && setViewImage({ title: board.title, thumbnail: board.thumbnail_data })}
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
                    <p className="font-medium text-sm truncate">{board.title}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(board.sent_at), "MMM d, yyyy 'at' h:mm a")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full view dialog */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewImage?.title}</DialogTitle>
          </DialogHeader>
          {viewImage?.thumbnail && (
            <div className="rounded-lg border border-border overflow-hidden bg-white">
              <img src={viewImage.thumbnail} alt={viewImage.title} className="w-full object-contain max-h-[70vh]" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
