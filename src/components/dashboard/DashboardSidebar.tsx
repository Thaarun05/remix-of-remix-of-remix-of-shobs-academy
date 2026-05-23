import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Menu,
  X,
  Calendar,
  CalendarDays,
  FileText,
  Users,
  Video,
  MessageSquare,
  Settings,
  ClipboardList,
  UserPlus,
  CalendarCheck,
  GraduationCap,
  ChevronRight,
  DollarSign,
  Receipt,
  FileSpreadsheet,
  PenTool,
  FolderOpen,
  Film,
  Sparkles
} from "lucide-react";

type RoleColor = "student" | "teacher" | "admin";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick?: () => void;
}

interface DashboardSidebarProps {
  items: SidebarItem[];
  activeItem: string;
  onItemClick: (id: string) => void;
  roleColor: RoleColor;
}

export function DashboardSidebar({ items, activeItem, onItemClick, roleColor }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const roleColorClasses = {
    student: {
      active: "dashboard-sidebar-item-active-student",
      hover: "hover:bg-student/5 hover:text-student",
      icon: "text-student",
      border: "border-student",
    },
    teacher: {
      active: "dashboard-sidebar-item-active-teacher",
      hover: "hover:bg-teacher/5 hover:text-teacher",
      icon: "text-teacher",
      border: "border-teacher",
    },
    admin: {
      active: "dashboard-sidebar-item-active-admin",
      hover: "hover:bg-admin/5 hover:text-admin",
      icon: "text-admin",
      border: "border-admin",
    },
  };

  const colorClasses = roleColorClasses[roleColor];

  const handleItemClick = (id: string) => {
    onItemClick(id);
    setIsMobileOpen(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Sidebar Header */}
      <div className="dashboard-sidebar-header">
        <span className={cn(
          "dashboard-sidebar-title",
          isCollapsed && "lg:hidden"
        )}>
          Navigation
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex h-8 w-8"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            isCollapsed && "rotate-180"
          )} />
        </Button>
      </div>

      {/* Sidebar Items */}
      <nav className="dashboard-sidebar-nav">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item.id)}
              className={cn(
                "dashboard-sidebar-item",
                isActive ? colorClasses.active : colorClasses.hover,
                isCollapsed && "lg:justify-center lg:px-3"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 flex-shrink-0",
                isActive && colorClasses.icon
              )} />
              <span className={cn(
                "dashboard-sidebar-item-text",
                isCollapsed && "lg:hidden"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className={cn(
                  "dashboard-sidebar-item-indicator",
                  colorClasses.border
                )} />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="dashboard-sidebar-mobile-toggle lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="dashboard-sidebar-overlay lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "dashboard-sidebar",
        isCollapsed && "lg:w-[72px]",
        isMobileOpen && "dashboard-sidebar-mobile-open"
      )}>
        <SidebarContent />
      </aside>
    </>
  );
}

// Export sidebar item configurations for each role
export const studentSidebarItems: SidebarItem[] = [
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "zoom", label: "Zoom", icon: Video },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "whiteboards", label: "Whiteboards", icon: PenTool },
  { id: "assignments", label: "Assignments", icon: FileText },
  { id: "fee-sheet", label: "Fee Sheet", icon: FileSpreadsheet },
  { id: "messages", label: "Messages", icon: MessageSquare },
];

export const teacherSidebarItems: SidebarItem[] = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "work-done", label: "Work Done", icon: CalendarCheck },
  { id: "assignments", label: "Assignments", icon: FileText },
  { id: "notes", label: "Notes", icon: FileText },
  { id: "whiteboard", label: "Whiteboard", icon: PenTool },
  { id: "resources", label: "Resources", icon: FolderOpen },
  { id: "recordings", label: "Recorded Classes", icon: Film },
  { id: "worksheet-builder", label: "Worksheet Builder", icon: Sparkles },
  { id: "manage", label: "Manage", icon: ClipboardList },
  { id: "zoom", label: "Zoom", icon: Video },
  { id: "salary", label: "My Salary", icon: DollarSign },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "profile", label: "Profile", icon: Settings },
];

export const adminSidebarItems: SidebarItem[] = [
  { id: "demo-requests", label: "Demo Requests", icon: CalendarCheck },
  { id: "create-teacher", label: "Create Teacher", icon: UserPlus },
  { id: "create-student", label: "Create Student", icon: GraduationCap },
  { id: "fee-sheet", label: "Fee Sheet", icon: FileSpreadsheet },
  { id: "fees", label: "Student Fees (Old)", icon: Receipt },
  { id: "salary", label: "Teacher Salary", icon: DollarSign },
  { id: "work-submissions", label: "Work Submissions", icon: ClipboardList },
  { id: "work-done", label: "Work Done", icon: CalendarCheck },
  { id: "resources", label: "Teacher Resources", icon: FolderOpen },
  { id: "recordings", label: "Recordings", icon: Film },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "all-users", label: "All Users", icon: Users },
];
