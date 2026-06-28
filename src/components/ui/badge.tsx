import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "secondary" | "outline" | "danger" | "success" | "warning";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md border px-2 text-xs font-medium",
        variant === "default" && "border-primary/40 bg-primary/15 text-primary",
        variant === "secondary" && "border-border bg-secondary text-secondary-foreground",
        variant === "outline" && "border-border bg-transparent text-muted-foreground",
        variant === "danger" && "border-destructive/40 bg-destructive/15 text-destructive",
        variant === "success" && "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
        variant === "warning" && "border-amber-400/40 bg-amber-400/10 text-amber-300",
        className,
      )}
      {...props}
    />
  );
}
