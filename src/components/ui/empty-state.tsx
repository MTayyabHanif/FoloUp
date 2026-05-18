import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * EmptyState — branded fallback for empty data sets. Replaces naked
 * "No data" text scattered across the app.
 *
 * <EmptyState
 *   title="No interviews yet"
 *   description="Create your first interview to get started."
 *   icon={<MessageSquare />}
 *   action={<Button>New interview</Button>}
 * />
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Size variant: `compact` for in-card empties, `default` for full-section. */
  size?: "compact" | "default";
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-secondary/30 text-center",
        size === "compact" ? "gap-2 px-6 py-8" : "gap-3 px-6 py-12",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full bg-brand-subtlest text-brand-bold",
            size === "compact" ? "h-10 w-10" : "h-14 w-14",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="max-w-md space-y-1">
        <h3 className={cn(
          "font-semibold tracking-tight",
          size === "compact" ? "text-sm" : "text-base",
        )}>
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
