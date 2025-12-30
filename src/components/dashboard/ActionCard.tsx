import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActionVariant = "student" | "teacher" | "admin" | "primary";

interface ActionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  variant?: ActionVariant;
  className?: string;
}

const variantStyles: Record<ActionVariant, { 
  bg: string; 
  iconBg: string; 
  iconColor: string;
  button: string;
}> = {
  student: { 
    bg: "bg-student/5 border-student/20",
    iconBg: "bg-student/10", 
    iconColor: "text-student",
    button: "bg-student hover:bg-student/90 text-student-foreground"
  },
  teacher: { 
    bg: "bg-teacher/5 border-teacher/20",
    iconBg: "bg-teacher/10", 
    iconColor: "text-teacher",
    button: "bg-teacher hover:bg-teacher/90 text-teacher-foreground"
  },
  admin: { 
    bg: "bg-admin/5 border-admin/20",
    iconBg: "bg-admin/10", 
    iconColor: "text-admin",
    button: "bg-admin hover:bg-admin/90 text-admin-foreground"
  },
  primary: { 
    bg: "bg-primary/5 border-primary/20",
    iconBg: "bg-primary/10", 
    iconColor: "text-primary",
    button: "bg-primary hover:bg-primary/90 text-primary-foreground"
  },
};

export function ActionCard({ 
  icon: Icon, 
  title, 
  description,
  actionLabel,
  onAction,
  variant = "primary",
  className 
}: ActionCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn("dashboard-action-card", styles.bg, className)}>
      <div className={cn("dashboard-action-icon", styles.iconBg)}>
        <Icon className={cn("h-8 w-8", styles.iconColor)} />
      </div>
      <h3 className="dashboard-action-title">{title}</h3>
      <p className="dashboard-action-description">{description}</p>
      <Button 
        onClick={onAction}
        className={cn("dashboard-action-button", styles.button)}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
