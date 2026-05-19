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
import { Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";

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
 *   │ Theme toggle row     │
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
        "flex h-full w-full flex-col border-r bg-card",
        className,
      )}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        className="flex h-14 items-center gap-2 border-b px-4"
        onClick={onNavigate}
      >
        <span className="text-xl font-bold tracking-tight">
          Folo<span className="text-brand-bold">Up</span>
        </span>
        <span className="rounded-full bg-brand-subtlest px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-bold">
          Beta
        </span>
      </Link>

      {/* Org switcher */}
      <div className="border-b px-3 py-3">
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
                "w-full justify-between rounded-md border border-transparent px-2 py-1.5 hover:bg-accent",
            },
          }}
        />
      </div>

      {/* Nav sections */}
      <nav
        aria-label="Primary"
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <div
            key={section.label ?? `section-${sectionIdx}`}
            className={cn(sectionIdx > 0 && "mt-6")}
          >
            {section.label ? (
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
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

      {/* Theme toggle row */}
      <SidebarThemeToggle />

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
    "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors";
  const interactiveClasses = isActive
    ? "bg-brand-subtlest text-brand-bold"
    : "text-foreground/80 hover:bg-accent hover:text-foreground";
  const disabledClasses = "cursor-not-allowed text-muted-foreground opacity-70";

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
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        onClick={onNavigate}
        className={cn(
          baseClasses,
          interactiveClasses,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-brand-bold)] focus-visible:ring-offset-1",
        )}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive
              ? "text-brand-bold"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span className="flex-1 truncate">{item.label}</span>
      </Link>
    </li>
  );
}

function SidebarThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const current = mounted
    ? theme === "system"
      ? resolvedTheme
      : theme
    : "light";
  const next = current === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-brand-bold)] focus-visible:ring-offset-1"
      aria-label={`Switch to ${next} mode`}
    >
      {mounted && current === "dark" ? (
        <Sun className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 text-left">
        {mounted && current === "dark" ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
}

function SidebarUserCard() {
  const { user } = useUser();
  const { organization } = useOrganization();

  return (
    <div className="flex items-center gap-3 border-t bg-card px-3 py-3">
      <UserButton afterSignOutUrl="/sign-in" signInUrl="/sign-in" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user?.fullName ?? user?.emailAddresses[0]?.emailAddress ?? "Account"}
        </p>
        {organization?.name ? (
          <p className="truncate text-xs text-muted-foreground">
            {organization.name}
          </p>
        ) : null}
      </div>
    </div>
  );
}
