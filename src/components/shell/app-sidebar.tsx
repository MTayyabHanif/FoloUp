"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { getPrimaryNavItems, isNavItemActive } from "@/components/shell/sidebar-nav";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * AppSidebar — icon-only primary navigation rail for the recruiter route group.
 *
 * Composition (compact rail, ~72px wide):
 *   ┌────┐
 *   │ RD │  ← brand mark
 *   ├────┤
 *   │ ◯  │  ← org switcher (avatar)
 *   ├────┤
 *   │ ⌂  │  ← nav icons (tooltip on hover)
 *   │ ◯  │
 *   ├────┤
 *   │ 👤 │  ← user button
 *   └────┘
 */
export function AppSidebar({
  className,
  onNavigate,
}: {
  className?: string;
  /** Optional callback invoked when a nav link is clicked. Used by the
   *  mobile drawer to auto-close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const primaryNavItems = React.useMemo(() => getPrimaryNavItems(), []);

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex h-full w-full flex-col items-center border-r border-[hsl(var(--border))] bg-[color:rgba(251,253,246,0.9)] py-4",
          className,
        )}
      >
        {/* Brand mark */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:rgba(197,204,182,0.92)] bg-[color:rgba(215,232,181,0.28)] text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-valley-green)] transition-colors hover:border-[var(--color-valley-green)]"
              onClick={onNavigate}
              aria-label="Robust Devs — Hiring workspace"
            >
              RD
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Robust Devs</TooltipContent>
        </Tooltip>

        <div className="my-2 h-px w-8 bg-[hsl(var(--border))]" />

        {/* Org switcher (avatar only) */}
        <div className="px-1">
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/dashboard"
            hidePersonal={true}
            afterSelectOrganizationUrl="/dashboard"
            afterLeaveOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "flex items-center justify-center",
                organizationSwitcherTrigger:
                  "p-1 rounded-full hover:bg-[color:rgba(215,232,181,0.22)] transition-colors",
                organizationPreviewMainIdentifier: "hidden",
                organizationSwitcherTriggerIcon: "hidden",
              },
            }}
          />
        </div>

        <div className="my-2 h-px w-8 bg-[hsl(var(--border))]" />

        {/* Nav sections */}
        <nav
          aria-label="Primary"
          className="flex w-full flex-1 flex-col items-center overflow-y-auto px-2 py-2"
        >
          <ul className="flex flex-col items-center space-y-2">
            {primaryNavItems.map((item) => (
              <SidebarLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </nav>

        {/* User account button */}
        <div className="mt-2 border-t border-[hsl(var(--border))] pt-4">
          <UserButton afterSignOutUrl="/sign-in" signInUrl="/sign-in" />
        </div>
      </aside>
    </TooltipProvider>
  );
}

function SidebarLink({
  item,
  pathname,
  onNavigate,
}: {
  item: {
    label: string;
    href: string;
    icon: LucideIcon;
    exact?: boolean;
    activePrefixes?: string[];
  };
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const isActive = isNavItemActive(item, pathname);

  const Icon = item.icon;

  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              "group flex h-11 w-11 items-center justify-center rounded-[16px] border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
              isActive
                ? "border-[color:rgba(159,177,127,0.5)] bg-[color:rgba(215,232,181,0.5)] text-[var(--color-valley-green)] shadow-[var(--shadow-subtle)]"
                : "border-transparent text-foreground/75 hover:border-[color:rgba(197,204,182,0.84)] hover:bg-[color:rgba(224,229,213,0.22)] hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            onClick={onNavigate}
          >
            <Icon
              className={cn(
                "h-5 w-5 shrink-0",
                isActive
                  ? "text-[var(--color-valley-green)]"
                  : "text-muted-foreground group-hover:text-[var(--color-valley-green)]",
              )}
            />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    </li>
  );
}
