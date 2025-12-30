import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { LogOut, Loader2, MessageSquare } from "lucide-react";
import { Navbar } from "@/components/Navbar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  roleLabel: string;
  roleColor: "student" | "teacher" | "admin";
}

export function DashboardLayout({ children, title, roleLabel, roleColor }: DashboardLayoutProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const unreadCount = useUnreadMessages();

  const roleColorClasses = {
    student: "bg-student/15 text-student border border-student/25",
    teacher: "bg-teacher/15 text-teacher border border-teacher/25",
    admin: "bg-admin/15 text-admin border border-admin/25",
  };

  return (
    <div className="min-h-screen page">
      {/* Global Navbar */}
      <Navbar showAboutLink={false} variant={roleColor} />

      {/* Role Badge & Unread Messages Header */}
      <header className="pt-[70px]">
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${roleColorClasses[roleColor]}`}>
              {roleLabel}
            </span>
            {unreadCount > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                <MessageSquare className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{unreadCount}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1280px] mx-auto px-6 py-8">
        <h1 className="font-display text-3xl font-bold text-foreground mb-8">{title}</h1>
        {children}
      </main>
    </div>
  );
}
