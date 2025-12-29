import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StartConversationButtonProps {
  studentUserId: string;
  onConversationCreated: (conversationId: string) => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}

export const StartConversationButton = ({
  studentUserId,
  onConversationCreated,
  variant = "outline",
  size = "sm",
}: StartConversationButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Check if conversation already exists
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("student_user_id", studentUserId)
        .eq("teacher_user_id", user.id)
        .maybeSingle();

      if (existing) {
        onConversationCreated(existing.id);
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from("conversations")
        .insert({
          student_user_id: studentUserId,
          teacher_user_id: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "Conversation started",
        description: "You can now message this student.",
      });

      onConversationCreated(newConv.id);
    } catch (error) {
      console.error("Error creating conversation:", error);
      toast({
        title: "Error",
        description: "Failed to start conversation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} variant={variant} size={size}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <MessageSquare className="h-4 w-4 mr-1" />
          Message
        </>
      )}
    </Button>
  );
};
