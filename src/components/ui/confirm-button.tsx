import { forwardRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmButtonProps extends Omit<ButtonProps, "onClick"> {
  /** Dialog heading, e.g. "Delete this note?" */
  confirmTitle: string;
  /** Explains what happens and whether it can be undone. */
  confirmDescription: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Any irreversible action should go through this so confirmation copy stays consistent. */
export const ConfirmButton = forwardRef<HTMLButtonElement, ConfirmButtonProps>(
  (
    {
      confirmTitle,
      confirmDescription,
      confirmLabel = "Delete",
      cancelLabel = "Cancel",
      destructive = true,
      onConfirm,
      children,
      ...buttonProps
    },
    ref,
  ) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button ref={ref} {...buttonProps}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmDescription}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
);
ConfirmButton.displayName = "ConfirmButton";
