import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * PageShell — the canonical recruiter-page container.
 *
 * Composition pattern (introduced in change #4):
 *   <PageShell>
 *     <PageHeader title="..." description="..." actions={<Button />} />
 *     <Section>... primary content ...</Section>
 *     <Section title="...">... secondary content ...</Section>
 *   </PageShell>
 *
 * Owns:
 *   - Max content width (1280px) so wide-screen content doesn't sprawl
 *   - Horizontal padding rhythm (px-6 mobile, px-8 ≥md)
 *   - Vertical rhythm between sections (gap-8)
 *   - Background = page background (transparent — Layout owns the page bg)
 */
export function PageShell({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="relative w-full">
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col gap-[var(--section-gap)] px-5 py-6 md:px-8 md:py-8",
          className,
        )}
        {...props}
      />
    </div>
  );
}

/**
 * PageHeader — title + description + trailing actions row.
 * Renders as a flex row at ≥md, stacked at mobile so actions don't get cut off.
 */
export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Trailing actions (Buttons, Switches, etc.). Will be flex-row aligned to the right. */
  actions?: React.ReactNode;
  /** Eyebrow text above the title (route group, breadcrumb-lite). */
  eyebrow?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 border-b border-[hsl(var(--border))] pb-8 md:flex-row md:items-end md:justify-between",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? (
          <p
            className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
            style={{ fontFamily: "var(--font-fragmentmono)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="truncate text-2xl font-semibold leading-[1.02] tracking-[-0.04em] text-[hsl(var(--foreground))]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 tracking-[-0.04em] text-muted-foreground md:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

/**
 * Section — a labeled content block within a PageShell. Use for grouping
 * related cards/widgets under an optional title.
 *
 * <Section title="Recent responses" description="..." actions={<...>}>
 *   <DataGrid>...</DataGrid>
 * </Section>
 */
export interface SectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Compact = less vertical gap between header and content (default true on inner-page sections). */
  compact?: boolean;
}

export function Section({
  title,
  description,
  actions,
  compact = false,
  className,
  children,
  ...props
}: SectionProps) {
  const hasHeader = title || description || actions;

  return (
    <section className={cn("flex flex-col", className)} {...props}>
      {hasHeader ? (
        <div
          className={cn(
            "flex flex-col gap-2 md:flex-row md:items-end md:justify-between",
            compact ? "mb-3" : "mb-5",
          )}
        >
          <div className="min-w-0 flex-1 space-y-1">
            {title ? (
              <h2 className="truncate text-lg font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))] md:text-xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm leading-6 tracking-[-0.04em] text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/**
 * DataGrid — responsive card grid. 1/2/3 columns at sm/md/lg viewports.
 * Pass `cols="2"` to cap at 2 columns max (e.g., for analytics blocks).
 */
export interface DataGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: "1" | "2" | "3" | "4";
}

const GRID_COLS = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
} as const;

export function DataGrid({
  className,
  cols = "3",
  ...props
}: DataGridProps) {

  return (
    <div
      className={cn("grid gap-5", GRID_COLS[cols], className)}
      {...props}
    />
  );
}
