"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  OrganizationSwitcher,
  UserButton,
  useUser,
  useOrganization,
} from "@clerk/nextjs";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { NAV_SECTIONS } from "@/components/shell/sidebar-nav";
import { cn } from "@/lib/utils";

/**
 * AppSidebar — primary navigation shell for the recruiter route group.
 *
 * Composition:
 *   ┌──────────────────────┐
 *   │ Brand wordmark       │  ← top
 *   ├──────────────────────┤
 *   │ Org switcher         │
 *   ├──────────────────────┤
 *   │ Nav sections         │  ← flex-1
 *   │   icon + label       │
 *   │   active highlight   │
 *   ├──────────────────────┤
 *   │ User avatar + name   │  ← bottom
 *   └──────────────────────┘
 *
 * Fixed-width on desktop (md:w-64), full-bleed inside a Drawer on mobile
 * (passed in via `<MobileSidebar />`).
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

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col border-r border-[hsl(var(--border))] bg-[color:rgba(251,253,246,0.9)]",
        className,
      )}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        className="border-b border-[hsl(var(--border))] px-5 py-5"
        onClick={onNavigate}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:rgba(197,204,182,0.92)] bg-[color:rgba(215,232,181,0.28)] text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-valley-green)]">
              F
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold tracking-[-0.04em] text-[hsl(var(--foreground))]">
                Foloup
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Hiring workspace
              </p>
            </div>
          </div>
          <div className="rounded-[24px] border border-[color:rgba(197,204,182,0.82)] bg-[color:rgba(224,229,213,0.24)] px-3 py-2">
            <p className="text-xs font-medium tracking-[-0.04em] text-[hsl(var(--foreground))]">
              Calm, focused interview operations for recruiters and interviewers.
            </p>
          </div>
        </div>
      </Link>

      {/* Org switcher */}
      <div className="border-b border-[hsl(var(--border))] px-4 py-4">
        <OrganizationSwitcher
          afterCreateOrganizationUrl="/dashboard"
          hidePersonal={true}
          afterSelectOrganizationUrl="/dashboard"
          afterLeaveOrganizationUrl="/dashboard"
          appearance={{
            variables: {
              fontSize: "0.875rem",
            },
            elements: {
              rootBox: "w-full",
              organizationSwitcherTrigger:
                "w-full justify-between rounded-[20px] border border-[color:rgba(197,204,182,0.86)] bg-[color:rgba(251,253,246,0.92)] px-3 py-3 text-[hsl(var(--foreground))] shadow-[var(--shadow-subtle)] transition-colors hover:border-[var(--color-valley-green)] hover:bg-[color:rgba(215,232,181,0.22)]",
            },
          }}
        />
      </div>

      {/* Nav sections */}
      <nav
        aria-label="Primary"
        className="flex-1 overflow-y-auto px-4 py-5"
      >
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div
            key={section.label ?? `section-${sectionIdx}`}
            className={cn(sectionIdx > 0 && "mt-6")}
          >
            {section.label ? (
              <p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-1.5">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User account card */}
      <SidebarUserCard />
    </aside>
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
    comingSoon?: boolean;
  };
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const isActive = item.exact
    ? pathname === item.href
    : pathname?.startsWith(item.href) ?? false;

  const Icon = item.icon;

  const baseClasses =
    "group flex items-center gap-3 rounded-[20px] border px-3 py-3 text-sm font-medium tracking-[-0.04em] transition-all";
  const interactiveClasses = isActive
    ? "border-[color:rgba(159,177,127,0.5)] bg-[color:rgba(215,232,181,0.5)] text-[var(--color-valley-green)] shadow-[var(--shadow-subtle)]"
    : "border-transparent text-foreground/75 hover:border-[color:rgba(197,204,182,0.84)] hover:bg-[color:rgba(224,229,213,0.22)] hover:text-foreground";
  const disabledClasses =
    "cursor-not-allowed border-transparent text-muted-foreground opacity-70";

  if (item.comingSoon) {
    return (
      <li>
        <div
          className={cn(baseClasses, disabledClasses)}
          aria-disabled="true"
          title="Coming soon"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{item.label}</span>
          <span className="rounded-full border border-[color:rgba(197,204,182,0.86)] bg-[color:rgba(251,253,246,0.86)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Soon
          </span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          baseClasses,
          interactiveClasses,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2",
        )}
        aria-current={isActive ? "page" : undefined}
        onClick={onNavigate}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive
              ? "text-[var(--color-valley-green)]"
              : "text-muted-foreground group-hover:text-[var(--color-valley-green)]",
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 opacity-0 transition-opacity",
            isActive
              ? "opacity-100 text-[var(--color-valley-green)]"
              : "group-hover:opacity-100",
          )}
        />
      </Link>
    </li>
  );
}

function SidebarUserCard() {
  const { user } = useUser();
  const { organization } = useOrganization();

  return (
    <div className="border-t border-[hsl(var(--border))] bg-[color:rgba(251,253,246,0.94)] px-4 py-4">
      <div className="flex items-center gap-3 rounded-[24px] border border-[color:rgba(197,204,182,0.84)] bg-[color:rgba(224,229,213,0.18)] px-3 py-3">
        <UserButton afterSignOutUrl="/sign-in" signInUrl="/sign-in" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium tracking-[-0.04em]">
            {user?.fullName ?? user?.emailAddresses[0]?.emailAddress ?? "Account"}
          </p>
          {organization?.name ? (
            <p className="truncate text-xs tracking-[0.04em] text-muted-foreground">
              {organization.name}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
