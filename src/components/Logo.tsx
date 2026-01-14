import { cn } from "@/lib/utils";
import shobsLogo from "@/assets/shobs-academy-logo.png";
interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}
export function Logo({
  size = "md",
  className
}: LogoProps) {
  const sizeClasses = {
    sm: "h-16 w-auto",
    md: "h-20 w-auto",
    lg: "h-32 w-auto",
    xl: "h-40 w-auto"
  };
  return <img src={shobsLogo} alt="Shobs Academy" className={cn("", sizeClasses[size], className)} />;
}