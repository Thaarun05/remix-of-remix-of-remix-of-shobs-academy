import { useCountUp } from "@/hooks/useCountUp";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

/** A single count-up statistic tile. */
export const AnimatedCounter = ({ value, suffix = "", prefix = "", label }: AnimatedCounterProps) => {
  const { ref, value: current } = useCountUp(value);

  return (
    <div className="surface-rim glow-hover rounded-2xl border border-border/70 bg-card/70 p-6 text-center backdrop-blur-sm">
      <span
        ref={ref}
        className="block font-display text-4xl font-extrabold tracking-tight text-gradient sm:text-5xl"
      >
        {prefix}
        {current.toLocaleString()}
        {suffix}
      </span>
      <span className="mt-2 block text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
};
