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
        "flex flex-col items-center justify-center rounded-[28px] border border-dashed border-[hsl(var(--border))] bg-[color:rgba(224,229,213,0.32)] text-center shadow-[var(--shadow-subtle)]",
        size === "compact" ? "gap-2 px-6 py-8" : "gap-4 px-6 py-12",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full border border-[color:rgba(197,204,182,0.9)] bg-[color:rgba(251,253,246,0.9)] text-[var(--color-valley-green)]",
            size === "compact" ? "h-10 w-10" : "h-14 w-14",
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="max-w-md space-y-1">
        <h3 className={cn(
          "font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))]",
          size === "compact" ? "text-sm" : "text-base",
        )}>
          {title}
        </h3>
        {description ? (
          <p className="text-sm tracking-[-0.04em] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
