import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Optional primary action, e.g. a "Create" button. */
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => {
  return (
    <div className={cn("state-panel", className)}>
      <div className="state-icon">
        <Icon className="h-6 w-6" />
      </div>
      <p className="state-eyebrow">Nothing here yet</p>
      <h3 className="state-title">{title}</h3>
      <p className="state-description">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
