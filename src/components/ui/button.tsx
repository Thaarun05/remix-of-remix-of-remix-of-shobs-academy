import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20",
        outline: "border border-border bg-card hover:bg-muted hover:text-foreground hover:border-primary/40",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90 hover:-translate-y-0.5 shadow-md shadow-secondary/20 hover:shadow-lg hover:shadow-secondary/30",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        student: "bg-student text-student-foreground hover:bg-student/90 hover:-translate-y-0.5 shadow-md shadow-student/20 hover:shadow-lg hover:shadow-student/30",
        teacher: "bg-teacher text-teacher-foreground hover:bg-teacher/90 hover:-translate-y-0.5 shadow-md shadow-teacher/20 hover:shadow-lg hover:shadow-teacher/30",
        admin: "bg-admin text-admin-foreground hover:bg-admin/90 hover:-translate-y-0.5 shadow-md shadow-admin/20 hover:shadow-lg hover:shadow-admin/30",
        hero: "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:from-primary/95 hover:to-primary-glow/95 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-1",
        success: "bg-success text-success-foreground hover:bg-success/90 shadow-md shadow-success/20",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-full px-4 text-xs",
        lg: "h-12 rounded-full px-8 text-base",
        xl: "h-14 rounded-full px-10 text-lg",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
