import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type StatVariant = "student" | "teacher" | "admin" | "primary" | "success" | "warning" | "destructive";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: {
    value: string;
    positive: boolean;
  };
  variant?: StatVariant;
  className?: string;
}

const variantStyles: Record<StatVariant, { iconBg: string; iconColor: string }> = {
  student: { iconBg: "bg-student/10", iconColor: "text-student" },
  teacher: { iconBg: "bg-teacher/10", iconColor: "text-teacher" },
  admin: { iconBg: "bg-admin/10", iconColor: "text-admin" },
  primary: { iconBg: "bg-primary/10", iconColor: "text-primary" },
  success: { iconBg: "bg-success/10", iconColor: "text-success" },
  warning: { iconBg: "bg-warning/10", iconColor: "text-warning" },
  destructive: { iconBg: "bg-destructive/10", iconColor: "text-destructive" },
};

export function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  trend,
  variant = "primary",
  className 
}: StatCardProps) {
  const styles = variantStyles[variant];

  return (
    <div className={cn("dashboard-stat-card", className)}>
      <div className="flex items-center gap-4">
        <div className={cn("dashboard-stat-icon", styles.iconBg)}>
          <Icon className={cn("h-5 w-5", styles.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="dashboard-stat-label">{label}</p>
          <p className="dashboard-stat-value">{value}</p>
        </div>
      </div>
      {trend && (
        <div className={cn(
          "dashboard-stat-trend",
          trend.positive ? "text-success" : "text-destructive"
        )}>
          {trend.positive ? "↑" : "↓"} {trend.value}
        </div>
      )}
    </div>
  );
}
