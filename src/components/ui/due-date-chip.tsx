import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function describeDueDate(dueDate: string | Date) {
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(new Date());
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < -1) return { text: `Overdue by ${Math.abs(days)} days`, tone: "overdue" as const, days };
  if (days === -1) return { text: "Overdue by 1 day", tone: "overdue" as const, days };
  if (days === 0) return { text: "Due today", tone: "urgent" as const, days };
  if (days === 1) return { text: "Due tomorrow", tone: "urgent" as const, days };
  if (days <= 7) return { text: `Due in ${days} days`, tone: "soon" as const, days };
  return { text: `Due ${due.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`, tone: "later" as const, days };
}

interface DueDateChipProps {
  dueDate: string | Date | null | undefined;
  /** When the work is already done, urgency is muted. */
  completed?: boolean;
  className?: string;
}

/** Human-readable deadline urgency, e.g. "Due today", "Overdue by 2 days". */
export function DueDateChip({ dueDate, completed = false, className }: DueDateChipProps) {
  if (!dueDate) return null;
  const { text } = describeDueDate(dueDate);
  const tone = completed ? "later" : describeDueDate(dueDate).tone;
  const toneClass = {
    overdue: "bg-destructive/10 text-destructive border-destructive/30",
    urgent: "bg-warning/12 text-warning border-warning/30",
    soon: "bg-primary/10 text-primary border-primary/25",
    later: "bg-muted text-muted-foreground border-border",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass,
        className,
      )}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      {completed ? new Date(dueDate).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : text}
    </span>
  );
}
