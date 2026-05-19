"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";

import Providers from "@/components/providers";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppHeader } from "@/components/shell/app-header";
import { AppFooter } from "@/components/shell/app-footer";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";

/**
 * (client) layout — recruiter route group. Owns the full platform shell:
 * sidebar (with brand, org switcher, navigation, user card),
 * sticky page header (breadcrumb + help), and recruiter footer.
 *
 * Layout structure:
 *   ┌──────────┬─────────────────────────────────┐
 *   │ Sidebar  │ Header (sticky)                 │
 *   │ 264px    │ ───────────────────────────────  │
 *   │ desktop  │ Main content (children)         │
 *   │ Drawer   │ ...                             │
 *   │ mobile   │ ───────────────────────────────  │
 *   │          │ Footer                          │
 *   └──────────┴─────────────────────────────────┘
 *
 * Auth routes (sign-in/sign-up) bypass the shell entirely — AuthShell
 * owns its own centered layout.
 */
export default function ClientGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthRoute =
    pathname?.includes("/sign-in") || pathname?.includes("/sign-up");
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  // Auto-close mobile sidebar on route change.
  React.useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  if (isAuthRoute) {
    return (
      <Providers>
        {children}
        <Toaster
          toastOptions={{
            classNames: {
              toast:
                "rounded-[24px] border border-[hsl(var(--border))] bg-[color:rgba(251,253,246,0.98)] text-[hsl(var(--foreground))] shadow-[var(--ds-shadow-overflow)]",
              title: "text-[hsl(var(--foreground))] tracking-[-0.04em]",
              description: "text-muted-foreground tracking-[-0.04em]",
            },
          }}
        />
      </Providers>
    );
  }

  return (
    <Providers>
      <div className="relative flex min-h-screen bg-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(215,232,181,0.2),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(224,229,213,0.28),transparent_28%)]"
        />
        {/* Desktop sidebar — permanent fixed column */}
        <div className="relative hidden h-screen w-80 shrink-0 md:sticky md:top-0 md:block">
          <AppSidebar />
        </div>

        {/* Mobile sidebar — slides in from left via Drawer */}
        <Drawer
          open={mobileSidebarOpen}
          onOpenChange={setMobileSidebarOpen}
        >
          <DrawerContent
            side="left"
            size="default"
            className="w-80 rounded-none p-0 sm:max-w-[20rem]"
          >
            <AppSidebar
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </DrawerContent>
        </Drawer>

        {/* Main content column */}
        <div className="relative flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1">{children}</main>
          <AppFooter />
        </div>
      </div>

      <Toaster
        toastOptions={{
          classNames: {
            toast:
              "rounded-[24px] border border-[hsl(var(--border))] bg-[color:rgba(251,253,246,0.98)] text-[hsl(var(--foreground))] shadow-[var(--ds-shadow-overflow)]",
            title: "text-[hsl(var(--foreground))] tracking-[-0.04em]",
            description: "text-muted-foreground tracking-[-0.04em]",
            actionButton:
              "rounded-full bg-[var(--color-amber-seed)] text-[var(--color-canvas-ice)]",
            cancelButton:
              "rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
            closeButton:
              "bg-[color:rgba(251,253,246,0.9)] text-[hsl(var(--foreground))]",
          },
        }}
      />
    </Providers>
  );
}
