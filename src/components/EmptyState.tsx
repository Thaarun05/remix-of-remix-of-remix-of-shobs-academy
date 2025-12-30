import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, className }: EmptyStateProps) => {
  return (
    <div className={cn("empty-state flex flex-col items-center justify-center py-12 px-4", className)}>
      <div className="empty-state-icon">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">{description}</p>
    </div>
  );
};
