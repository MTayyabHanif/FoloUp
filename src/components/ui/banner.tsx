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
  info: "border-blue-200 bg-blue-50 text-blue-900 [&_svg]:text-blue-600",
  success: "border-green-200 bg-green-50 text-green-900 [&_svg]:text-green-600",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 [&_svg]:text-amber-600",
  danger:
    "border-destructive/30 bg-destructive/10 text-destructive [&_svg]:text-destructive",
  brand:
    "border-brand-subtle bg-brand-subtlest text-foreground [&_svg]:text-brand-bold",
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
        "flex flex-col gap-2 rounded-lg border px-4 py-3 md:flex-row md:items-center",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-medium leading-tight">{title}</p>
        {description ? (
          <p className="text-sm leading-snug opacity-90">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
