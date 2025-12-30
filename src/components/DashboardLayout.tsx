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
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { cn } from "@/lib/utils";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  roleLabel: string;
  roleColor: "student" | "teacher" | "admin";
  sidebarItems?: SidebarItem[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function DashboardLayout({ 
  children, 
  title, 
  roleLabel, 
  roleColor,
  sidebarItems,
  activeTab,
  onTabChange
}: DashboardLayoutProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const unreadCount = useUnreadMessages();

  const pageColorClasses = {
    student: "dashboard-page-student",
    teacher: "dashboard-page-teacher",
    admin: "dashboard-page-admin",
  };

  const roleBadgeClasses = {
    student: "dashboard-role-badge-student",
    teacher: "dashboard-role-badge-teacher",
    admin: "dashboard-role-badge-admin",
  };

  return (
    <div className={cn("min-h-screen", pageColorClasses[roleColor])}>
      {/* Global Navbar */}
      <Navbar showAboutLink={false} variant={roleColor} />

      {/* Dashboard Layout with Sidebar */}
      <div className="dashboard-layout">
        {/* Sidebar Navigation */}
        {sidebarItems && activeTab && onTabChange && (
          <DashboardSidebar
            items={sidebarItems}
            activeItem={activeTab}
            onItemClick={onTabChange}
            roleColor={roleColor}
          />
        )}

        {/* Main Content Area */}
        <main className={cn(
          "dashboard-main",
          sidebarItems && "lg:ml-[280px]"
        )}>
          <div className="dashboard-content">
            {/* Dashboard Header */}
            <header className="dashboard-header dashboard-animate-in">
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className="dashboard-title">{title}</h1>
                <span className={cn("dashboard-role-badge", roleBadgeClasses[roleColor])}>
                  {roleLabel}
                </span>
              </div>
              {unreadCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">{unreadCount} unread</span>
                </div>
              )}
            </header>

            {/* Page Content */}
            <div className="dashboard-animate-in" style={{ animationDelay: "0.1s" }}>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
