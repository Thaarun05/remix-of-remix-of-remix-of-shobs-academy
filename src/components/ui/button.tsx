import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold tracking-[0.01em] ring-offset-background transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
      outline: "border border-input bg-card text-foreground hover:bg-muted hover:border-primary/40",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
      ghost: "hover:bg-muted hover:text-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      student: "bg-student text-student-foreground hover:bg-student/90 shadow-sm",
      teacher: "bg-teacher text-teacher-foreground hover:bg-teacher/90 shadow-sm",
      admin: "bg-admin text-admin-foreground hover:bg-admin/90 shadow-sm",
      hero: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
      success: "bg-success text-success-foreground hover:bg-success/90 shadow-sm"
    },
    size: {
      default: "h-10 px-5 py-2",
      sm: "h-8 rounded-md px-3 text-xs",
      lg: "h-11 rounded-lg px-7 text-[15px]",
      xl: "h-12 rounded-lg px-9 text-base",
      icon: "h-10 w-10 rounded-lg"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant,
  size,
  asChild = false,
  ...props
}, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";
export { Button, buttonVariants };