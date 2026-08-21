import { ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: ReactNode;
  className?: string;
  strength?: number;
}

/**
 * Wraps a CTA so it gently follows the cursor. Disabled for touch devices and
 * for users who prefer reduced motion.
 */
export const MagneticButton = ({ children, className, strength = 14 }: MagneticButtonProps) => {
  const ref = useRef<HTMLSpanElement>(null);

  const reduced = () =>
    typeof window !== "undefined" &&
    (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia?.("(hover: none)").matches);

  const onMove = (e: React.MouseEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el || reduced()) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * strength * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * strength;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };

  const reset = () => {
    if (ref.current) ref.current.style.transform = "translate3d(0, 0, 0)";
  };

  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={cn("magnetic inline-flex", className)}
    >
      {children}
    </span>
  );
};
