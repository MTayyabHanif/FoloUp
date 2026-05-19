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
 * sidebar (with brand, org switcher, navigation, theme toggle, user card),
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
              toast: "bg-white",
              title: "text-black",
              description: "text-red-400",
            },
          }}
        />
      </Providers>
    );
  }

  return (
    <Providers>
      <div className="flex min-h-screen bg-background">
        {/* Desktop sidebar — permanent fixed column */}
        <div className="hidden h-screen w-64 shrink-0 md:sticky md:top-0 md:block">
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
            className="w-72 p-0"
          >
            <AppSidebar
              onNavigate={() => setMobileSidebarOpen(false)}
            />
          </DrawerContent>
        </Drawer>

        {/* Main content column */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AppHeader onMenuClick={() => setMobileSidebarOpen(true)} />
          <main className="flex-1">{children}</main>
          <AppFooter />
        </div>
      </div>

      <Toaster
        toastOptions={{
          classNames: {
            toast: "bg-white",
            title: "text-black",
            description: "text-red-400",
            actionButton: "bg-brand-subtle",
            cancelButton: "bg-orange-400",
            closeButton: "bg-white",
          },
        }}
      />
    </Providers>
  );
}
