import { cn } from "@/lib/utils";
import shobsLogo from "@/assets/shobs-academy-logo.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Logo({ size = "md", className }: LogoProps) {
  const sizeClasses = {
    sm: "h-10 w-auto",
    md: "h-12 w-auto",
    lg: "h-20 w-auto",
    xl: "h-24 w-auto",
  };

  return (
    <img
      src={shobsLogo}
      alt="Shobs Academy"
      className={cn(sizeClasses[size], className)}
    />
  );
}
