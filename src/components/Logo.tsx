import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-14 w-14",
  };

  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center font-display font-bold text-white shadow-lg",
        "bg-gradient-to-br from-primary to-secondary",
        sizeClasses[size],
        className
      )}
    >
      <span className={cn(
        size === "sm" ? "text-sm" : size === "md" ? "text-base" : "text-xl"
      )}>
        S
      </span>
    </div>
  );
}
