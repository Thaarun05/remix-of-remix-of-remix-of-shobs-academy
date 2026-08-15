import { AlertTriangle, Loader2, LucideIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Short status line, e.g. "Loading assignments" */
  label?: string;
  description?: string;
  className?: string;
}

export function LoadingState({
  label = "Loading",
  description = "Fetching the latest information.",
  className,
}: LoadingStateProps) {
  return (
    <div className={cn("state-panel", className)} role="status" aria-live="polite">
      <div className="state-icon">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <p className="state-title">{label}</p>
      {description && <p className="state-description">{description}</p>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this section. Please try again in a moment.",
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div className={cn("state-panel", className)} role="alert">
      <div className="state-icon state-icon-error">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <p className="state-eyebrow">Error</p>
      <p className="state-title">{title}</p>
      {description && <p className="state-description">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

interface InlineSpinnerProps {
  label?: string;
  className?: string;
}

/** Compact inline loader for buttons rows, tables and small panels. */
export function InlineSpinner({ label = "Loading…", className }: InlineSpinnerProps) {
  return (
    <div
      className={cn("flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground", className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}

interface StatePanelProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Generic status panel matching the empty/loading/error typography scale. */
export function StatePanel({ icon: Icon, title, description, action, className }: StatePanelProps) {
  return (
    <div className={cn("state-panel", className)}>
      <div className="state-icon">
        <Icon className="h-6 w-6" />
      </div>
      <p className="state-title">{title}</p>
      {description && <p className="state-description">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}