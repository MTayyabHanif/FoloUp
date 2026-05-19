import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Banner — top-of-page or top-of-section notification strip. Replaces ad-hoc
 * divs that recreate this pattern with different colors on every route.
 *
 * <Banner tone="warning" title="Plan limit reached" description="..." />
 *
 * Variants align with ADS status tokens (information / success / warning /
 * danger). Each variant uses a tinted background derived from our brand
 * ramp or destructive token — no new tokens introduced.
 */
export type BannerTone = "info" | "success" | "warning" | "danger" | "brand";

const TONE_CLASSES: Record<BannerTone, string> = {
  info:
    "border-[color:rgba(197,204,182,0.9)] bg-[color:rgba(251,253,246,0.92)] text-[hsl(var(--foreground))] [&_svg]:text-[var(--color-valley-green)]",
  success:
    "border-[color:rgba(159,177,127,0.55)] bg-[color:rgba(215,232,181,0.42)] text-[hsl(var(--foreground))] [&_svg]:text-[var(--color-valley-green)]",
  warning:
    "border-[color:rgba(74,50,18,0.18)] bg-[color:rgba(74,50,18,0.08)] text-[var(--color-deep-earth)] [&_svg]:text-[var(--color-amber-seed)]",
  danger:
    "border-[color:rgba(146,74,55,0.26)] bg-[color:rgba(146,74,55,0.08)] text-[hsl(var(--foreground))] [&_svg]:text-destructive",
  brand:
    "border-[color:rgba(159,177,127,0.55)] bg-[color:rgba(215,232,181,0.32)] text-[hsl(var(--foreground))] [&_svg]:text-[var(--color-valley-green)]",
};

const TONE_ICONS: Record<BannerTone, React.ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  brand: Info,
};

export interface BannerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: BannerTone;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
}

export function Banner({
  tone = "info",
  title,
  description,
  action,
  onDismiss,
  className,
  ...props
}: BannerProps) {
  const Icon = TONE_ICONS[tone];

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-[28px] border px-5 py-4 shadow-[var(--shadow-subtle)] md:flex-row md:items-center",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-medium leading-tight tracking-[-0.04em]">{title}</p>
        {description ? (
          <p className="text-sm leading-snug tracking-[-0.04em] opacity-90">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
