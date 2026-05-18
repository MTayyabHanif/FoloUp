"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

/**
 * Linear progress bar (Radix Progress).
 * Replaces NextUI Progress for determinate bar use cases.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-brand-bold transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

/**
 * Circular indeterminate spinner using SVG circle + animated stroke-dasharray.
 * Drop-in replacement for `@nextui-org/react` CircularProgress and `@nextui-org/progress` CircularProgress.
 *
 * Sizes match common usage: sm=16, md=24 (default), lg=32, xl=48.
 */
export interface SpinnerProgressProps
  extends React.SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg" | "xl";
  /** Accessible label for screen readers; defaults to "Loading". */
  label?: string;
}

const SIZE_PX = { sm: 16, md: 24, lg: 32, xl: 48 } as const;

const SpinnerProgress = React.forwardRef<SVGSVGElement, SpinnerProgressProps>(
  (
    { className, size = "md", label = "Loading", ...props },
    ref,
  ) => {
    const px = SIZE_PX[size];
    const stroke = size === "sm" ? 2 : 3;
    const radius = (px - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    return (
      <svg
        ref={ref}
        role="status"
        aria-label={label}
        viewBox={`0 0 ${px} ${px}`}
        width={px}
        height={px}
        className={cn("animate-spin", className)}
        style={{
          animationDuration: "var(--ds-motion-duration-slow, 1s)",
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
        }}
        {...props}
      >
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth={stroke}
        />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.25} ${circumference}`}
        />
      </svg>
    );
  },
);
SpinnerProgress.displayName = "SpinnerProgress";

export { Progress, SpinnerProgress };
