import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { BookOpen, LogOut, Loader2, MessageSquare } from "lucide-react";

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
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const roleColorClasses = {
    student: "bg-student/15 text-student border border-student/25",
    teacher: "bg-teacher/15 text-teacher border border-teacher/25",
    admin: "bg-admin/15 text-admin border border-admin/25",
  };

  return (
    <div className="min-h-screen page">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/60 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-md shadow-primary/20">
                  <BookOpen className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-display text-xl font-semibold text-foreground hidden sm:block">
                  Shobs Academy
                </span>
              </Link>
              <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${roleColorClasses[roleColor]}`}>
                {roleLabel}
              </span>
            </div>
            <div className="flex items-center gap-4">
              {unreadCount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">{unreadCount}</span>
                </div>
              )}
              <span className="text-sm text-muted-foreground hidden sm:block">
                {user?.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                disabled={signingOut}
                className="gap-2"
              >
                {signingOut ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </>
                )}
              </Button>
            </div>
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
