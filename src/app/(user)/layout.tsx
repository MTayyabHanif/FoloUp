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
      <div className="flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
        <CandidateFooter />
      </div>
      <Toaster
        toastOptions={{
          classNames: {
            toast: "bg-white border-2 border-brand-subtle",
            title: "text-black",
            description: "text-red-400",
          },
        }}
      />
    </Providers>
  );
}
