import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MessageSquare, Loader2, Send, Shield } from "lucide-react";

interface AdminContact {
  user_id: string;
  full_name: string | null;
}

interface AdminMessage {
  id: string;
  sender_user_id: string;
  receiver_user_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface AdminMessagingProps {
  userRole: "student" | "teacher";
}

export function AdminMessaging({ userRole }: AdminMessagingProps) {
  const { user } = useAuth();
  const [admin, setAdmin] = useState<AdminContact | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isStudent = userRole === "student";

  useEffect(() => {
    if (user) {
      fetchAdminAndConversation();
    }
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!conversationId) return;

    const tableName = isStudent ? "student_admin_messages" : "teacher_admin_messages";
    
    const channel = supabase
      .channel(`admin-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: tableName,
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as AdminMessage;
          setMessages((prev) => [...prev, newMessage]);
          
          // Mark as read if we're the receiver
          if (newMessage.receiver_user_id === user?.id && !newMessage.read_at) {
            markMessageAsRead(newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, isStudent]);

  const fetchAdminAndConversation = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Find an admin user
      const { data: adminData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("role", "admin")
        .limit(1)
        .maybeSingle();

      if (adminData) {
        setAdmin(adminData);

        // Check for existing conversation
        if (isStudent) {
          const { data: existingConvo } = await supabase
            .from("student_admin_conversations")
            .select("id")
            .eq("student_user_id", user.id)
            .eq("admin_user_id", adminData.user_id)
            .maybeSingle();

          if (existingConvo) {
            setConversationId(existingConvo.id);
            await fetchMessages(existingConvo.id);
          }
        } else {
          const { data: existingConvo } = await supabase
            .from("teacher_admin_conversations")
            .select("id")
            .eq("teacher_user_id", user.id)
            .eq("admin_user_id", adminData.user_id)
            .maybeSingle();

          if (existingConvo) {
            setConversationId(existingConvo.id);
            await fetchMessages(existingConvo.id);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching admin:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convoId: string) => {
    const tableName = isStudent ? "student_admin_messages" : "teacher_admin_messages";
    
    const { data } = await supabase
      .from(tableName)
      .select("*")
      .eq("conversation_id", convoId)
      .order("created_at", { ascending: true });

    setMessages((data as AdminMessage[]) || []);

    // Mark unread messages as read
    const unreadMessages = (data || []).filter(
      (m) => m.receiver_user_id === user?.id && !m.read_at
    );
    for (const msg of unreadMessages) {
      await markMessageAsRead(msg.id);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    const tableName = isStudent ? "student_admin_messages" : "teacher_admin_messages";
    
    await supabase
      .from(tableName)
      .update({ read_at: new Date().toISOString() })
      .eq("id", messageId);
  };

  const startConversation = async (): Promise<string | null> => {
    if (!user || !admin) return null;

    try {
      if (isStudent) {
        const { data, error } = await supabase
          .from("student_admin_conversations")
          .insert({
            student_user_id: user.id,
            admin_user_id: admin.user_id,
          })
          .select()
          .single();

        if (error) throw error;
        return data.id;
      } else {
        const { data, error } = await supabase
          .from("teacher_admin_conversations")
          .insert({
            teacher_user_id: user.id,
            admin_user_id: admin.user_id,
          })
          .select()
          .single();

        if (error) throw error;
        return data.id;
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
      return null;
    }
  };

  const handleSend = async () => {
    if (!content.trim() || !user || !admin || sending) return;

    let convoId = conversationId;

    // Create conversation if it doesn't exist
    if (!convoId) {
      convoId = await startConversation();
      if (convoId) {
        setConversationId(convoId);
      }
    }

    if (!convoId) return;

    setSending(true);
    const tableName = isStudent ? "student_admin_messages" : "teacher_admin_messages";
    
    try {
      const { error } = await supabase.from(tableName).insert({
        conversation_id: convoId,
        sender_user_id: user.id,
        receiver_user_id: admin.user_id,
        content: content.trim(),
      });

      if (error) throw error;
      setContent("");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!admin) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No admin available for support.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-admin/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-admin" />
          </div>
          <div>
            <CardTitle className="text-lg">Admin Support</CardTitle>
            <CardDescription>{admin.full_name || "Academy Admin"}</CardDescription>
          </div>
          <Badge className="ml-auto bg-admin/10 text-admin border-admin/20">Admin</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No messages yet.</p>
              <p className="text-sm text-muted-foreground">Send a message to get help from admin.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => {
                const isMe = message.sender_user_id === user?.id;
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col max-w-[80%]",
                      isMe ? "ml-auto items-end" : "mr-auto items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2",
                        isMe
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">
                      {format(new Date(message.created_at), "p")}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!content.trim() || sending}
              size="icon"
              className="shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
