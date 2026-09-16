import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Props {
  userRole: "parent" | "admin";
}

interface Thread {
  conversation_id: string | null;
  peer_user_id: string;
  name: string;
  unread: number;
  last_preview: string;
}

interface Msg {
  id: string;
  conversation_id: string;
  sender_user_id: string;
  receiver_user_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export const ParentAdminMessaging = ({ userRole }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadThreads = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: convs } = await supabase
        .from("parent_admin_conversations")
        .select("id, student_user_id, admin_user_id")
        .order("created_at", { ascending: false });

      const convList = convs || [];
      const cids = convList.map((c) => c.id);

      const [unreadRes, msgsRes] = await Promise.all([
        cids.length
          ? supabase
              .from("parent_admin_messages")
              .select("conversation_id")
              .in("conversation_id", cids)
              .eq("receiver_user_id", user.id)
              .is("read_at", null)
          : Promise.resolve({ data: [] as any[] }),
        cids.length
          ? supabase
              .from("parent_admin_messages")
              .select("conversation_id, content, created_at")
              .in("conversation_id", cids)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const unreadMap = new Map<string, number>();
      for (const m of (unreadRes.data || []) as any[]) {
        unreadMap.set(m.conversation_id, (unreadMap.get(m.conversation_id) || 0) + 1);
      }
      const previewMap = new Map<string, string>();
      for (const m of (msgsRes.data || []) as any[]) {
        if (!previewMap.has(m.conversation_id)) previewMap.set(m.conversation_id, m.content);
      }

      if (userRole === "parent") {
        const mine = convList.filter((c) => c.student_user_id === user.id);
        if (mine.length === 0) {
          const { data: adminRows } = await supabase.rpc("get_academy_admin");
          const admin = (adminRows as any[])?.[0];
          setThreads(
            admin
              ? [
                  {
                    conversation_id: null,
                    peer_user_id: admin.user_id,
                    name: admin.full_name || "Academy Admin",
                    unread: 0,
                    last_preview: "",
                  },
                ]
              : []
          );
        } else {
          setThreads(
            mine.map((c) => ({
              conversation_id: c.id,
              peer_user_id: c.admin_user_id,
              name: "Academy Admin",
              unread: unreadMap.get(c.id) || 0,
              last_preview: previewMap.get(c.id) || "",
            }))
          );
        }
      } else {
        const studentIds = Array.from(new Set(convList.map((c) => c.student_user_id)));
        const { data: names } = studentIds.length
          ? await supabase
              .from("student_profiles")
              .select("user_id, student_name")
              .in("user_id", studentIds)
          : { data: [] as any[] };
        const nameMap = new Map((names || []).map((n: any) => [n.user_id, n.student_name]));
        setThreads(
          convList.map((c) => ({
            conversation_id: c.id,
            peer_user_id: c.student_user_id,
            name: `${nameMap.get(c.student_user_id) || "Student"} (parent)`,
            unread: unreadMap.get(c.id) || 0,
            last_preview: previewMap.get(c.id) || "",
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userRole]);

  const openThread = async (thread: Thread) => {
    setSelected(thread);
    setMessages([]);
    if (!thread.conversation_id || !user) return;
    const { data } = await supabase
      .from("parent_admin_messages")
      .select("*")
      .eq("conversation_id", thread.conversation_id)
      .order("created_at", { ascending: true });
    setMessages((data || []) as Msg[]);

    const unreadIds = (data || [])
      .filter((m: any) => m.receiver_user_id === user.id && !m.read_at)
      .map((m: any) => m.id);
    if (unreadIds.length) {
      await supabase
        .from("parent_admin_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds);
      loadThreads();
    }
  };

  useEffect(() => {
    if (!selected?.conversation_id) return;
    const channel = supabase
      .channel(`parent-admin-${selected.conversation_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "parent_admin_messages",
          filter: `conversation_id=eq.${selected.conversation_id}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg])
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selected?.conversation_id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!user || !selected || !content.trim()) return;
    setSending(true);
    try {
      let conversationId = selected.conversation_id;
      if (!conversationId) {
        const studentId = userRole === "parent" ? user.id : selected.peer_user_id;
        const adminId = userRole === "parent" ? selected.peer_user_id : user.id;
        const { data, error } = await supabase
          .from("parent_admin_conversations")
          .insert({ student_user_id: studentId, admin_user_id: adminId })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = data.id;
        setSelected({ ...selected, conversation_id: conversationId });
      }

      const { error: msgError } = await supabase.from("parent_admin_messages").insert({
        conversation_id: conversationId,
        sender_user_id: user.id,
        receiver_user_id: selected.peer_user_id,
        content: content.trim(),
      });
      if (msgError) throw msgError;

      setContent("");
      const { data } = await supabase
        .from("parent_admin_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      setMessages((data || []) as Msg[]);
      loadThreads();
    } catch (error: any) {
      toast({
        title: "Message not sent",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (selected) {
    return (
      <Card className="flex h-[70vh] flex-col">
        <CardHeader className="flex-row items-center gap-3 space-y-0 border-b">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-base">{selected.name}</CardTitle>
        </CardHeader>
        <CardContent ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
          {messages.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No messages yet. Start the conversation below.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.sender_user_id === user?.id ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                  m.sender_user_id === user?.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className="mt-1 text-[11px] opacity-70">
                  {new Date(m.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write a message…"
            className="min-h-[44px] resize-none"
          />
          <Button onClick={send} disabled={sending || !content.trim()} aria-label="Send message">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          {userRole === "parent" ? "Message the academy" : "Parent messages"}
        </CardTitle>
        <CardDescription>
          {userRole === "parent"
            ? "Reach the academy admin directly about your child."
            : "Conversations started by parents."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {threads.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No conversations yet.</p>
        )}
        {threads.map((t) => (
          <button
            key={t.peer_user_id + (t.conversation_id ?? "")}
            onClick={() => openThread(t)}
            className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0">
              <p className="font-medium">{t.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {t.last_preview || "No messages yet"}
              </p>
            </div>
            {t.unread > 0 && <Badge>{t.unread}</Badge>}
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
