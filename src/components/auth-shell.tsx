"use client";

import * as React from "react";
import { Construction } from "lucide-react";

/**
 * Shared shell for /sign-in and /sign-up routes. Centers the Clerk
 * component on the page with proper background and mobile fallback.
 *
 * Replaces the absolute-positioned top-0 left-0 z-50 trick the previous
 * sign-in/sign-up pages used (which forced the auth view to overlay the
 * recruiter layout — unnecessary now that (client)/layout.tsx detects
 * isAuthRoute and omits Navbar + SideMenu for these routes).
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Desktop: centered Clerk component on a clean background. */}
      <div className="hidden min-h-screen w-full items-center justify-center bg-background p-6 md:flex">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Mobile fallback: branded "use desktop" card. */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10 md:hidden">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-[var(--ds-shadow-overlay)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-subtlest text-brand-bold">
            <Construction className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-semibold">
            Robust <span className="text-brand-bold">Devs Hiring</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Mobile sign-in is under construction. Please use a desktop browser
            for the best experience.
          </p>
        </div>
      </div>
    </>
  );
}
