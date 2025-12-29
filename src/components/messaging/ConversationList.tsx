import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MessageSquare, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  student_user_id: string;
  teacher_user_id: string;
  created_at: string;
  other_user_name: string;
  unread_count: number;
}

interface ConversationListProps {
  userRole: "student" | "teacher";
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onConversationsLoaded?: (conversations: Conversation[]) => void;
}

export const ConversationList = ({
  userRole,
  selectedConversationId,
  onSelectConversation,
  onConversationsLoaded,
}: ConversationListProps) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: convData, error } = await supabase
        .from("conversations")
        .select("id, student_user_id, teacher_user_id, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get the other user's name for each conversation
      const enrichedConversations: Conversation[] = [];
      
      for (const conv of convData || []) {
        const otherUserId = userRole === "student" ? conv.teacher_user_id : conv.student_user_id;
        
        // Get name from appropriate profile table
        let otherUserName = "Unknown";
        if (userRole === "student") {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", otherUserId)
            .maybeSingle();
          otherUserName = profile?.full_name || "Teacher";
        } else {
          const { data: studentProfile } = await supabase
            .from("student_profiles")
            .select("student_name")
            .eq("user_id", otherUserId)
            .maybeSingle();
          otherUserName = studentProfile?.student_name || "Student";
        }

        // Get unread count
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .eq("receiver_user_id", user.id)
          .is("read_at", null);

        enrichedConversations.push({
          ...conv,
          other_user_name: otherUserName,
          unread_count: count || 0,
        });
      }

      setConversations(enrichedConversations);
      onConversationsLoaded?.(enrichedConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to new messages to update unread counts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("conversation-updates")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {userRole === "student" 
            ? "No conversations yet. Your teacher will message you."
            : "No conversations yet. Select a student to start messaging."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelectConversation(conv.id)}
          className={cn(
            "w-full p-3 rounded-lg text-left transition-colors",
            "hover:bg-muted/50 border border-transparent",
            selectedConversationId === conv.id
              ? "bg-primary/10 border-primary/20"
              : "bg-background"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground truncate">
              {conv.other_user_name}
            </span>
            {conv.unread_count > 0 && (
              <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                {conv.unread_count}
              </Badge>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};
