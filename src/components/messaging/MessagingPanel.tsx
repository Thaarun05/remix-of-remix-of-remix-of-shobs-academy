import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { MessageInput } from "./MessageInput";
import { MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Conversation {
  id: string;
  student_user_id: string;
  teacher_user_id: string;
  created_at: string;
  other_user_name: string;
  unread_count: number;
}

interface MessagingPanelProps {
  userRole: "student" | "teacher" | "admin";
  preselectedConversationId?: string | null;
}

export const MessagingPanel = ({ userRole, preselectedConversationId }: MessagingPanelProps) => {
  const { user } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    preselectedConversationId || null
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    if (preselectedConversationId) {
      setSelectedConversationId(preselectedConversationId);
    }
  }, [preselectedConversationId]);

  useEffect(() => {
    if (selectedConversationId && conversations.length > 0) {
      const conv = conversations.find((c) => c.id === selectedConversationId);
      setSelectedConversation(conv || null);
    } else {
      setSelectedConversation(null);
    }
  }, [selectedConversationId, conversations]);

  const getReceiverUserId = () => {
    if (!selectedConversation || !user) return "";
    if (userRole === "admin") {
      // Admin can view but not directly reply - they're viewing conversations
      return selectedConversation.student_user_id;
    }
    return userRole === "student"
      ? selectedConversation.teacher_user_id
      : selectedConversation.student_user_id;
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center gap-3">
          {selectedConversationId && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversationId(null)}
              className="md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages
            </CardTitle>
            <CardDescription>
              {selectedConversation
                ? `Conversation with ${selectedConversation.other_user_name}`
                : "Your conversations"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex gap-4 p-4 pt-0 overflow-hidden">
        {/* Conversation List - hidden on mobile when a conversation is selected */}
        <div
          className={`w-full md:w-64 shrink-0 border-r border-border pr-4 overflow-y-auto ${
            selectedConversationId ? "hidden md:block" : ""
          }`}
        >
          <ConversationList
            userRole={userRole}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            onConversationsLoaded={setConversations}
          />
        </div>

        {/* Message Thread */}
        <div
          className={`flex-1 flex flex-col overflow-hidden ${
            !selectedConversationId ? "hidden md:flex" : ""
          }`}
        >
          {selectedConversationId && selectedConversation ? (
            <>
              <MessageThread conversationId={selectedConversationId} userRole={userRole} />
              <MessageInput
                conversationId={selectedConversationId}
                receiverUserId={getReceiverUserId()}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Select a conversation to view messages
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
