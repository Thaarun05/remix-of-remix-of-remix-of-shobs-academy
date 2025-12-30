import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const sizeClasses = {
    sm: "h-12 w-12 text-xl",
    md: "h-12 w-12 text-xl",
    lg: "h-14 w-14 text-2xl",
  };

  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center font-display font-bold text-white",
        "bg-gradient-to-br from-[hsl(239,84%,67%)] to-[hsl(180,75%,40%)]",
        "shadow-[0_8px_16px_hsla(239,84%,67%,0.25)]",
        sizeClasses[size],
        className
      )}
    >
      <span>S</span>
    </div>
  );
}
