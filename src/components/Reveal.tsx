import { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/useInView";

interface RevealProps {
  children: ReactNode;
  /** Delay in ms before the reveal starts (use for staggered lists). */
  delay?: number;
  className?: string;
  /** Render as a different element, e.g. "li", "article", "section". */
  as?: ElementType;
}

/** Fades and lifts its children into view on scroll. Respects reduced motion. */
export const Reveal = ({ children, delay = 0, className, as }: RevealProps) => {
  const { ref, inView } = useInView<HTMLDivElement>();
  const Tag = (as ?? "div") as ElementType;

  return (
    <Tag
      ref={ref}
      className={cn("reveal", inView && "reveal-in", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
};
