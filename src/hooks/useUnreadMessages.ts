import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUnreadMessages() {
  const { user, role } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !role) return;

    const fetchUnreadCount = async () => {
      let count = 0;

      try {
        // Count unread messages from student-teacher conversations (existing table)
        const { count: teacherStudentCount } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("receiver_user_id", user.id)
          .is("read_at", null);

        count += teacherStudentCount || 0;

        // Count unread messages from student-admin conversations
        if (role === "student" || role === "admin") {
          const { count: studentAdminCount } = await supabase
            .from("student_admin_messages")
            .select("*", { count: "exact", head: true })
            .eq("receiver_user_id", user.id)
            .is("read_at", null);

          count += studentAdminCount || 0;
        }

        // Count unread messages from teacher-admin conversations
        if (role === "teacher" || role === "admin") {
          const { count: teacherAdminCount } = await supabase
            .from("teacher_admin_messages")
            .select("*", { count: "exact", head: true })
            .eq("receiver_user_id", user.id)
            .is("read_at", null);

          count += teacherAdminCount || 0;
        }

        setUnreadCount(count);
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();

    // Subscribe to new messages for real-time updates
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Main messages channel
    const mainChannel = supabase
      .channel("unread-messages-main")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `receiver_user_id=eq.${user.id}`,
        },
        () => fetchUnreadCount()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `receiver_user_id=eq.${user.id}`,
        },
        () => fetchUnreadCount()
      )
      .subscribe();

    channels.push(mainChannel);

    // Student-admin messages channel
    if (role === "student" || role === "admin") {
      const studentAdminChannel = supabase
        .channel("unread-student-admin")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "student_admin_messages",
          },
          () => fetchUnreadCount()
        )
        .subscribe();

      channels.push(studentAdminChannel);
    }

    // Teacher-admin messages channel
    if (role === "teacher" || role === "admin") {
      const teacherAdminChannel = supabase
        .channel("unread-teacher-admin")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "teacher_admin_messages",
          },
          () => fetchUnreadCount()
        )
        .subscribe();

      channels.push(teacherAdminChannel);
    }

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [user, role]);

  return unreadCount;
}
