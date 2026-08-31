import { useCountUp } from "@/hooks/useCountUp";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  /** Renders for placement on a dark hero surface. */
  onDark?: boolean;
}

/** A single count-up statistic tile. */
export const AnimatedCounter = ({
  value,
  suffix = "",
  prefix = "",
  label,
  onDark = false,
}: AnimatedCounterProps) => {
  const { ref, value: current } = useCountUp(value);

  return (
    <div
      className={cn(
        "glow-hover rounded-2xl border p-6 text-center backdrop-blur-sm",
        onDark
          ? "border-white/15 bg-white/[0.06]"
          : "surface-rim border-border/70 bg-card/70"
      )}
    >
      <span
        ref={ref}
        className={cn(
          "block font-display text-4xl font-extrabold tracking-tight sm:text-5xl",
          onDark ? "text-white" : "text-gradient"
        )}
      >
        {prefix}
        {current.toLocaleString()}
        {suffix}
      </span>
      <span
        className={cn(
          "mt-2 block text-sm font-medium",
          onDark ? "text-white/70" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
};
