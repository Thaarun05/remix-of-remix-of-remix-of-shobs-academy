import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Message {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_for_role: string | null;
  original_content: string | null;
  edited_at: string | null;
}

interface MessageThreadProps {
  conversationId: string;
  userRole?: string;
}

export const MessageThread = ({ conversationId, userRole }: MessageThreadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === "admin";
  const isTeacher = userRole === "teacher";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      markMessagesAsRead();
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Filter messages based on role
      const filteredMessages = (data || []).filter((msg: Message) => {
        // Admins see all messages including deleted ones
        if (isAdmin) return true;
        // Non-admins don't see deleted messages
        return !msg.deleted_at;
      });
      
      setMessages(filteredMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!user) return;
    
    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("receiver_user_id", user.id)
      .is("read_at", null);
  };

  const handleEdit = (message: Message) => {
    setEditingId(message.id);
    setEditContent(message.content);
  };

  const saveEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    
    try {
      const message = messages.find(m => m.id === editingId);
      const originalContent = message?.original_content || message?.content;
      
      const { error } = await supabase
        .from("messages")
        .update({
          content: editContent.trim(),
          original_content: originalContent,
          edited_at: new Date().toISOString(),
        })
        .eq("id", editingId);

      if (error) throw error;

      setMessages(prev => prev.map(m => 
        m.id === editingId 
          ? { ...m, content: editContent.trim(), original_content: originalContent || null, edited_at: new Date().toISOString() }
          : m
      ));
      
      toast({ title: "Message updated" });
      setEditingId(null);
      setEditContent("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId || !user) return;
    
    try {
      const { error } = await supabase
        .from("messages")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          deleted_for_role: userRole || "teacher",
        })
        .eq("id", deleteConfirmId);

      if (error) throw error;

      // For non-admins, remove from view
      if (!isAdmin) {
        setMessages(prev => prev.filter(m => m.id !== deleteConfirmId));
      } else {
        // Admins can still see it but it will show as deleted
        setMessages(prev => prev.map(m => 
          m.id === deleteConfirmId 
            ? { ...m, deleted_at: new Date().toISOString(), deleted_by: user.id }
            : m
        ));
      }
      
      toast({ title: "Message deleted" });
      setDeleteConfirmId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Subscribe to message changes
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newMessage = payload.new as Message;
            if (!newMessage.deleted_at || isAdmin) {
              setMessages((prev) => [...prev, newMessage]);
            }
            if (newMessage.receiver_user_id === user?.id) {
              markMessagesAsRead();
            }
          } else if (payload.eventType === "UPDATE") {
            const updatedMessage = payload.new as Message;
            setMessages((prev) => prev.map(m => 
              m.id === updatedMessage.id ? updatedMessage : m
            ).filter(m => isAdmin || !m.deleted_at));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user, isAdmin]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          No messages yet. Start the conversation!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => {
          const isOwn = message.sender_user_id === user?.id;
          const isDeleted = !!message.deleted_at;
          const isEdited = !!message.edited_at;
          const canEdit = isTeacher && isOwn && !isDeleted;
          const canDelete = isTeacher && isOwn && !isDeleted;

          return (
            <div
              key={message.id}
              className={cn(
                "flex flex-col max-w-[75%] group",
                isOwn ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              {editingId === message.id ? (
                <div className="flex items-center gap-2 w-full">
                  <Input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" onClick={saveEdit}>
                    <Check className="h-4 w-4 text-success" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "px-4 py-2 rounded-2xl relative",
                        isDeleted && "opacity-50 italic",
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      )}
                    >
                      {isDeleted && isAdmin ? (
                        <div className="space-y-1">
                          <p className="text-sm line-through">{message.content}</p>
                          <p className="text-xs text-destructive">[Deleted by {message.deleted_for_role}]</p>
                          {message.original_content && message.original_content !== message.content && (
                            <p className="text-xs">Original: {message.original_content}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      )}
                    </div>
                    
                    {/* Edit/Delete buttons for teachers */}
                    {(canEdit || canDelete) && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        {canEdit && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6"
                            onClick={() => handleEdit(message)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-destructive"
                            onClick={() => setDeleteConfirmId(message.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(message.created_at), "MMM d, h:mm a")}
                    </span>
                    {isEdited && !isDeleted && (
                      <span className="text-xs text-muted-foreground italic">(edited)</span>
                    )}
                    {/* Show original content to admin if edited */}
                    {isAdmin && message.original_content && message.original_content !== message.content && !isDeleted && (
                      <span className="text-xs text-muted-foreground">
                        [Original: {message.original_content.substring(0, 30)}...]
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be removed from the conversation. Admins can still see deleted messages for oversight.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
