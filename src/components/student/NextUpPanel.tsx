import { CalendarClock, FileText, ListChecks, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DueDateChip, describeDueDate } from "@/components/ui/due-date-chip";
import { cn } from "@/lib/utils";

export interface NextUpClass {
  title: string;
  startTime: string;
  meetingUrl?: string | null;
}

export interface NextUpAssignment {
  id: string;
  title: string;
  dueDate: string | null;
}

interface NextUpPanelProps {
  nextClass: NextUpClass | null;
  nextAssignment: NextUpAssignment | null;
  openQuizzes: number;
  onGoToSchedule: () => void;
  onGoToAssignments: () => void;
  onGoToQuizzes: () => void;
}

function formatClassTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today at ${time}`;
  if (isTomorrow) return `Tomorrow at ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} at ${time}`;
}

function Tile({
  icon: Icon,
  eyebrow,
  title,
  meta,
  action,
  onAction,
  tone = "default",
}: {
  icon: typeof CalendarClock;
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  action: string;
  onAction: () => void;
  tone?: "default" | "urgent";
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-xl border bg-card p-4",
        tone === "urgent" ? "border-destructive/30" : "border-border",
      )}
    >
      <div className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {eyebrow}
        </p>
        <p className="font-semibold text-foreground leading-snug line-clamp-2">{title}</p>
        {meta && <div className="text-sm text-muted-foreground">{meta}</div>}
      </div>
      <Button variant="outline" size="sm" className="self-start" onClick={onAction}>
        {action}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

/** "What do I do next" summary shown at the top of the student dashboard. */
export function NextUpPanel({
  nextClass,
  nextAssignment,
  openQuizzes,
  onGoToSchedule,
  onGoToAssignments,
  onGoToQuizzes,
}: NextUpPanelProps) {
  const assignmentTone =
    nextAssignment?.dueDate && describeDueDate(nextAssignment.dueDate).days <= 0 ? "urgent" : "default";

  return (
    <section aria-labelledby="next-up-heading" className="mb-8">
      <h2 id="next-up-heading" className="mb-3 text-base font-semibold text-foreground">
        Next up
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Tile
          icon={CalendarClock}
          eyebrow="Next class"
          title={nextClass ? nextClass.title : "No class scheduled"}
          meta={nextClass ? formatClassTime(nextClass.startTime) : "Your teacher will add your next session."}
          action="View schedule"
          onAction={onGoToSchedule}
        />
        <Tile
          icon={FileText}
          eyebrow="Next assignment"
          title={nextAssignment ? nextAssignment.title : "Nothing due"}
          meta={
            nextAssignment ? (
              <DueDateChip dueDate={nextAssignment.dueDate} />
            ) : (
              "You are up to date on submissions."
            )
          }
          action="Open assignments"
          onAction={onGoToAssignments}
          tone={assignmentTone}
        />
        <Tile
          icon={ListChecks}
          eyebrow="Quizzes"
          title={openQuizzes > 0 ? `${openQuizzes} quiz${openQuizzes === 1 ? "" : "zes"} to attempt` : "No open quizzes"}
          meta={openQuizzes > 0 ? "Attempts remaining on assigned quizzes." : "New quizzes appear here when assigned."}
          action="Go to quizzes"
          onAction={onGoToQuizzes}
        />
      </div>
    </section>
  );
}
