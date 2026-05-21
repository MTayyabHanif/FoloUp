import { Briefcase, LayoutDashboard, type LucideIcon, Users } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match the route exactly, not just prefix. Use for index routes. */
  exact?: boolean;
  /** Additional route prefixes that should keep the item active. */
  activePrefixes?: string[];
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Jobs",
    href: "/jobs",
    icon: Briefcase,
    activePrefixes: ["/interviews"],
  },
  {
    label: "Personas",
    href: "/personas",
    icon: Users,
    activePrefixes: ["/dashboard/interviewers"],
  },
];

export function matchesRoutePrefix(pathname: string | null, prefix: string) {
  if (!pathname) {
    return false;
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isNavItemActive(item: NavItem, pathname: string | null) {
  return (
    (item.exact ? pathname === item.href : matchesRoutePrefix(pathname, item.href)) ||
    (item.activePrefixes?.some((prefix) => matchesRoutePrefix(pathname, prefix)) ?? false)
  );
}

export function getPrimaryNavItems() {
  return PRIMARY_NAV_ITEMS;
}
