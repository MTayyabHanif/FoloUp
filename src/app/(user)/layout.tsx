import { Toaster } from "sonner";

import Providers from "@/components/providers";
import { CandidateFooter } from "@/components/shell/app-footer";

/**
 * (user) layout — candidate route group. Sidebar-less focused experience:
 * just the candidate flow content + a minimal branded footer. The
 * candidate-side <CandidateShell> (in /call/[id]/page.tsx) handles
 * vertical centering and the page's max-width.
 */
export default function UserGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <div className="relative flex min-h-screen flex-col bg-background">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_center,rgba(215,232,181,0.22),transparent_24%),linear-gradient(180deg,rgba(224,229,213,0.22),transparent_22%)]"
        />
        <main className="flex-1">{children}</main>
        <CandidateFooter />
      </div>
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
