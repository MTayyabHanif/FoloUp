import {
  LayoutDashboard,
  Users,
  Settings,
  HelpCircle,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match the route exactly, not just prefix. Use for index routes. */
  exact?: boolean;
  /** Render the item but with reduced opacity + no-link behavior. */
  comingSoon?: boolean;
};

export type NavSection = {
  /** Section label rendered as an uppercase eyebrow above the items. */
  label?: string;
  items: NavItem[];
};

/**
 * Sidebar navigation manifest. Single source of truth so the
 * AppSidebar component stays declarative and easy to extend.
 *
 * Order matters — top-most section appears first under the org
 * switcher; bottom-most sits above the user account card.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        label: "Interviewers",
        href: "/dashboard/interviewers",
        icon: Users,
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        comingSoon: true,
      },
      {
        label: "Help & docs",
        href: "/dashboard/help",
        icon: HelpCircle,
        comingSoon: true,
      },
      {
        label: "Changelog",
        href: "/dashboard/changelog",
        icon: BookOpen,
        comingSoon: true,
      },
    ],
  },
];
