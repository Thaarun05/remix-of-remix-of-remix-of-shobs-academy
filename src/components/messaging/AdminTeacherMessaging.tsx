import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageSquare, Send, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Props {
  userRole: "admin" | "teacher";
}

interface Peer {
  user_id: string;
  name: string;
  conversation_id: string | null;
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

export const AdminTeacherMessaging = ({ userRole }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [peers, setPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load peer list
  const loadPeers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (userRole === "admin") {
        const { data: teachers } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("role", "teacher");
        const { data: convs } = await supabase
          .from("admin_teacher_conversations")
          .select("id, teacher_user_id")
          .eq("admin_user_id", user.id);
        const convMap = new Map((convs || []).map((c) => [c.teacher_user_id, c.id]));

        const enriched: Peer[] = await Promise.all(
          (teachers || []).map(async (t) => {
            const cid = convMap.get(t.user_id) ?? null;
            let unread = 0;
            let preview = "";
            if (cid) {
              const { count } = await supabase
                .from("admin_teacher_messages")
                .select("*", { count: "exact", head: true })
                .eq("conversation_id", cid)
                .eq("receiver_user_id", user.id)
                .is("read_at", null);
              unread = count || 0;
              const { data: last } = await supabase
                .from("admin_teacher_messages")
                .select("content")
                .eq("conversation_id", cid)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              preview = last?.content || "";
            }
            return {
              user_id: t.user_id,
              name: t.full_name || "Teacher",
              conversation_id: cid,
              unread,
              last_preview: preview,
            };
          })
        );
        setPeers(enriched);
      } else {
        // teacher: list conversations + admin info
        const { data: convs } = await supabase
          .from("admin_teacher_conversations")
          .select("id, admin_user_id")
          .eq("teacher_user_id", user.id);
        const adminIds = (convs || []).map((c) => c.admin_user_id);
        const { data: admins } = adminIds.length
          ? await supabase
              .from("profiles")
              .select("user_id, full_name")
              .in("user_id", adminIds)
          : { data: [] as any[] };
        const nameMap = new Map((admins || []).map((a: any) => [a.user_id, a.full_name]));

        const enriched: Peer[] = await Promise.all(
          (convs || []).map(async (c) => {
            const { count } = await supabase
              .from("admin_teacher_messages")
              .select("*", { count: "exact", head: true })
              .eq("conversation_id", c.id)
              .eq("receiver_user_id", user.id)
              .is("read_at", null);
            const { data: last } = await supabase
              .from("admin_teacher_messages")
              .select("content")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            return {
              user_id: c.admin_user_id,
              name: nameMap.get(c.admin_user_id) || "Admin",
              conversation_id: c.id,
              unread: count || 0,
              last_preview: last?.content || "",
            };
          })
        );
        setPeers(enriched);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeers();
  }, [user, userRole]);

  // Realtime subscription to refresh peer list / messages on insert
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`atm-${userRole}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "admin_teacher_messages" },
        (payload) => {
          const row = (payload.new || payload.old) as Msg;
          if (!row) return;
          if (selectedPeer && row.conversation_id === selectedPeer.conversation_id) {
            loadMessages(selectedPeer.conversation_id!);
          }
          loadPeers();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userRole, selectedPeer?.conversation_id]);

  const loadMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("admin_teacher_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) || []);

    // mark received messages as read
    if (user) {
      await supabase
        .from("admin_teacher_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("receiver_user_id", user.id)
        .is("read_at", null);
    }
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 50);
  };

  const openPeer = async (peer: Peer) => {
    if (!user) return;
    let conversationId = peer.conversation_id;
    if (!conversationId) {
      // admin-side: create conversation lazily
      if (userRole !== "admin") return;
      const { data, error } = await supabase
        .from("admin_teacher_conversations")
        .upsert(
          { admin_user_id: user.id, teacher_user_id: peer.user_id },
          { onConflict: "admin_user_id,teacher_user_id" }
        )
        .select("id")
        .single();
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      conversationId = data.id;
    }
    const updated: Peer = { ...peer, conversation_id: conversationId };
    setSelectedPeer(updated);
    await loadMessages(conversationId!);
    loadPeers();
  };

  const send = async () => {
    if (!user || !selectedPeer?.conversation_id || !content.trim() || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.from("admin_teacher_messages").insert({
        conversation_id: selectedPeer.conversation_id,
        sender_user_id: user.id,
        receiver_user_id: selectedPeer.user_id,
        content: content.trim(),
      });
      if (error) throw error;
      setContent("");
      await loadMessages(selectedPeer.conversation_id);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const listTitle = userRole === "admin" ? "Teachers" : "Admin Conversations";
  const emptyText =
    userRole === "admin"
      ? "No teachers found."
      : "No conversations yet. An admin will start a conversation with you.";

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <div className="flex items-center gap-3">
          {selectedPeer && (
            <Button variant="ghost" size="icon" onClick={() => setSelectedPeer(null)} className="md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              {userRole === "admin" ? "Teacher Messages" : "Admin Messages"}
            </CardTitle>
            <CardDescription>
              {selectedPeer ? `Conversation with ${selectedPeer.name}` : listTitle}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex gap-4 p-4 pt-0 overflow-hidden">
        <div
          className={cn(
            "w-full md:w-64 shrink-0 border-r border-border pr-4 overflow-y-auto",
            selectedPeer && "hidden md:block"
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : peers.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{emptyText}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {peers.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => openPeer(p)}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-colors hover:bg-muted/50 border border-transparent",
                    selectedPeer?.user_id === p.user_id ? "bg-primary/10 border-primary/20" : "bg-background"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">{p.name}</span>
                    {p.unread > 0 && (
                      <Badge variant="default" className="bg-primary text-primary-foreground text-xs">
                        {p.unread}
                      </Badge>
                    )}
                  </div>
                  {p.last_preview && (
                    <p className="text-xs text-muted-foreground truncate mt-1">{p.last_preview}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn("flex-1 flex flex-col overflow-hidden", !selectedPeer && "hidden md:flex")}>
          {selectedPeer ? (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    No messages yet. Say hello!
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_user_id === user?.id;
                    return (
                      <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words",
                            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          )}
                        >
                          {m.content}
                          <div className={cn("text-[10px] mt-1 opacity-70", mine ? "text-primary-foreground" : "text-muted-foreground")}>
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="pt-3 border-t border-border mt-3">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Type a message... (Enter to send)"
                    className="min-h-[44px] max-h-32 resize-none"
                    rows={1}
                  />
                  <Button onClick={send} disabled={!content.trim() || sending} size="icon" className="shrink-0">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {userRole === "admin" ? "Select a teacher to start messaging" : "Select a conversation to view messages"}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
