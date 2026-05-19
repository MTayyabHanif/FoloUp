"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, HelpCircle, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AppHeader — sticky top bar inside the main content column (right of the
 * sidebar on desktop, full-width on mobile).
 *
 * Composition:
 *   ┌─────────────────────────────────────────────────────┐
 *   │ ☰  Breadcrumb (Dashboard / Interview)    [? · …]   │
 *   └─────────────────────────────────────────────────────┘
 *
 *   On mobile: hamburger triggers a Drawer-wrapped AppSidebar.
 *   On desktop: hamburger is hidden; sidebar is permanently visible.
 *
 * Breadcrumb is derived from pathname; pages can pass a `pageTitle` to
 * override the last crumb (e.g., interview name instead of route segment).
 */
export interface AppHeaderProps {
  /** Optional override for the last breadcrumb crumb. Defaults to the
   *  prettified last route segment. */
  pageTitle?: string;
  /** Mobile menu toggle handler — provided by the layout that owns the
   *  drawer state. */
  onMenuClick?: () => void;
}

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  interviewers: "Interviewers",
  interviews: "Interviews",
  settings: "Settings",
  help: "Help & docs",
  changelog: "Changelog",
};

function humanize(segment: string): string {
  if (!segment) {
    return "";
  }
  if (ROUTE_LABELS[segment]) {
    return ROUTE_LABELS[segment];
  }
  // Dynamic segments (e.g. interview ID): just truncate.
  if (segment.length > 24) {
    return segment.slice(0, 8) + "…";
  }
  return segment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AppHeader({ pageTitle, onMenuClick }: AppHeaderProps) {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/").filter(Boolean);

  // Build the breadcrumb trail, with the optional pageTitle overriding the
  // final crumb if provided.
  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const isLast = idx === segments.length - 1;
    const label =
      isLast && pageTitle ? pageTitle : humanize(seg);
    return { href, label, isLast };
  });

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6",
      )}
    >
      {onMenuClick ? (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open navigation"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
      ) : null}

      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-sm"
      >
        {crumbs.length === 0 ? (
          <span className="text-muted-foreground">Home</span>
        ) : (
          crumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.href}>
              {idx > 0 ? (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
              {crumb.isLast ? (
                <span
                  className="truncate font-medium text-foreground"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          ))
        )}
      </nav>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help"
          onClick={() => {
            window.open(
              process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://folo-up.co/",
              "_blank",
              "noopener,noreferrer",
            );
          }}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
