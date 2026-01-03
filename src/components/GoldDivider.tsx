import { cn } from "@/lib/utils";

interface GoldDividerProps {
  className?: string;
}

export const GoldDivider = ({ className }: GoldDividerProps) => {
  return (
    <div className={cn("flex items-center justify-center py-2", className)}>
      <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
      <div className="mx-3 h-1.5 w-1.5 rotate-45 bg-gold shadow-[0_0_8px_hsl(var(--gold)/0.5)]" />
      <div className="h-px w-24 bg-gold/80 shadow-[0_0_10px_hsl(var(--gold)/0.3)]" />
      <div className="mx-3 h-1.5 w-1.5 rotate-45 bg-gold shadow-[0_0_8px_hsl(var(--gold)/0.5)]" />
      <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  );
};
