import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StatusVariant = "pending" | "active" | "completed" | "overdue" | "submitted";

interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: StatusVariant;
  statusLabel?: string;
  timestamp?: string;
  onClick?: () => void;
}

interface ListCardProps {
  title: string;
  description?: string;
  items: ListItem[];
  emptyMessage?: string;
  className?: string;
}

const statusStyles: Record<StatusVariant, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  active: "bg-success/10 text-success border-success/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  submitted: "bg-teacher/10 text-teacher border-teacher/20",
};

export function ListCard({ 
  title, 
  description, 
  items, 
  emptyMessage = "No items to display",
  className 
}: ListCardProps) {
  return (
    <Card className={cn("dashboard-list-card", className)}>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="dashboard-list-empty">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="dashboard-list-items">
            {items.map((item) => (
              <div 
                key={item.id}
                onClick={item.onClick}
                className={cn(
                  "dashboard-list-item",
                  item.onClick && "cursor-pointer"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="dashboard-list-item-title">{item.title}</p>
                  {item.subtitle && (
                    <p className="dashboard-list-item-subtitle">{item.subtitle}</p>
                  )}
                  {item.timestamp && (
                    <p className="dashboard-list-item-timestamp">{item.timestamp}</p>
                  )}
                </div>
                {item.status && item.statusLabel && (
                  <Badge 
                    variant="outline" 
                    className={cn("shrink-0", statusStyles[item.status])}
                  >
                    {item.statusLabel}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
