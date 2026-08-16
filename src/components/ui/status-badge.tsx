import { cn } from "@/lib/utils";

export type StatusKind =
  | "pending"
  | "submitted"
  | "viewed"
  | "graded"
  | "approved"
  | "rejected"
  | "overdue"
  | "draft"
  | "active"
  | "inactive"
  | "paid"
  | "due";

const STATUS_MAP: Record<StatusKind, { label: string; className: string }> = {
  pending:   { label: "Pending",   className: "bg-warning/12 text-warning border-warning/30" },
  submitted: { label: "Submitted", className: "bg-primary/10 text-primary border-primary/25" },
  viewed:    { label: "Viewed",    className: "bg-muted text-muted-foreground border-border" },
  graded:    { label: "Graded",    className: "bg-success/12 text-success border-success/30" },
  approved:  { label: "Approved",  className: "bg-success/12 text-success border-success/30" },
  rejected:  { label: "Rejected",  className: "bg-destructive/10 text-destructive border-destructive/30" },
  overdue:   { label: "Overdue",   className: "bg-destructive/10 text-destructive border-destructive/30" },
  draft:     { label: "Draft",     className: "bg-muted text-muted-foreground border-border" },
  active:    { label: "Active",    className: "bg-success/12 text-success border-success/30" },
  inactive:  { label: "Inactive",  className: "bg-muted text-muted-foreground border-border" },
  paid:      { label: "Paid",      className: "bg-success/12 text-success border-success/30" },
  due:       { label: "Due",       className: "bg-warning/12 text-warning border-warning/30" },
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

/** Single shared status vocabulary used by student, teacher and admin screens. */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = (status || "").toLowerCase().replace(/\s+/g, "_") as StatusKind;
  const entry = STATUS_MAP[key] ?? {
    label: status ? status.replace(/_/g, " ") : "Unknown",
    className: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap",
        entry.className,
        className,
      )}
    >
      {label ?? entry.label}
    </span>
  );
}
