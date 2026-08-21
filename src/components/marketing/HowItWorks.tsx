import { CalendarCheck, ClipboardList, LineChart, MessageSquare } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils";

const steps = [
  { icon: MessageSquare, step: "01", title: "Book a free demo", body: "Tell us the student's year group, subject and goals. We arrange a no-obligation trial lesson." },
  { icon: ClipboardList, step: "02", title: "Meet your teacher", body: "The demo doubles as an assessment. The teacher identifies gaps and proposes a plan for the term." },
  { icon: CalendarCheck, step: "03", title: "Start regular classes", body: "Lessons run to an agreed timetable with worksheets, quizzes and attendance logged after every session." },
  { icon: LineChart, step: "04", title: "Track the results", body: "Parents and students follow attendance, submissions and scores in the portal, with regular updates." },
];

/** Vertical journey timeline with a line that draws itself as it scrolls in. */
export const HowItWorks = () => {
  const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.15 });

  return (
    <ol ref={ref} className="relative mt-12 space-y-8 pl-10 sm:pl-14">
      <span
        aria-hidden="true"
        className="absolute left-[15px] top-2 w-px bg-gradient-to-b from-primary via-primary/60 to-transparent transition-[height] duration-[1400ms] ease-out sm:left-[23px]"
        style={{ height: inView ? "calc(100% - 1rem)" : "0%" }}
      />
      {steps.map(({ icon: Icon, step, title, body }, i) => (
        <li
          key={step}
          className={cn(
            "reveal relative rounded-2xl border border-border/70 bg-card/80 p-6 backdrop-blur-sm glow-hover surface-rim",
            inView && "reveal-in"
          )}
          style={{ transitionDelay: `${i * 140}ms` }}
        >
          <span
            aria-hidden="true"
            className="absolute -left-10 top-6 flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-background text-primary shadow-[var(--shadow-indigo)] sm:-left-14 sm:h-12 sm:w-12"
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <span className="font-mono text-xs font-semibold tracking-[0.18em] text-primary">STEP {step}</span>
          <h3 className="mt-2 font-display text-lg font-bold text-foreground">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </li>
      ))}
    </ol>
  );
};

export default HowItWorks;
