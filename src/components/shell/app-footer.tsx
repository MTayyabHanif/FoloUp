import Link from "next/link";

/**
 * AppFooter — recruiter footer. Sits at the bottom of the main content
 * column. Minimal: brand, version, legal/help links.
 */
export function AppFooter() {
  const marketingUrl =
    process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://robustagency.co";
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-[hsl(var(--border))] bg-[color:rgba(251,253,246,0.92)] px-6 py-5 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 text-xs text-muted-foreground lg:flex-row lg:items-center">
        <div className="space-y-1">
          <p className="tracking-[-0.04em]">
            © {year}{" "}
            <span className="font-semibold text-foreground">
              Foloup
            </span>
            . All rights reserved.
          </p>
          <p className="max-w-xl tracking-[-0.04em] text-muted-foreground">
            Built for interview operations, candidate review, and consistent hiring decisions.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="rounded-full border border-[color:rgba(197,204,182,0.82)] bg-[color:rgba(224,229,213,0.18)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--color-valley-green)]">
            Light-only Adaline
          </span>
          <a
            href={marketingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--color-valley-green)]"
          >
            Marketing site
          </a>
          <a
            href={`${marketingUrl.replace(/\/$/, "")}/privacy`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--color-valley-green)]"
          >
            Privacy
          </a>
          <a
            href={`${marketingUrl.replace(/\/$/, "")}/terms`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--color-valley-green)]"
          >
            Terms
          </a>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-[var(--color-valley-green)]"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </footer>
  );
}

/**
 * CandidateFooter — minimal footer used in the candidate flow. Single
 * "Powered by Robust Devs" attribution + Privacy. Replaces the inline
 * <PoweredBy> component in /call/[id]/page.tsx.
 */
export function CandidateFooter() {
  const marketingUrl =
    process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://robustagency.co";

  return (
    <footer className="border-t border-[hsl(var(--border))] bg-[color:rgba(251,253,246,0.9)] py-5 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 sm:flex-row sm:justify-center sm:gap-3">
        <span className="tracking-[-0.04em]">
          Powered by{" "}
          <a
            href={marketingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground transition-colors hover:text-[var(--color-valley-green)]"
          >
            Foloup
          </a>
        </span>
        <span className="hidden text-muted-foreground/40 sm:inline">·</span>
        <a
          href={`${marketingUrl.replace(/\/$/, "")}/privacy`}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-[var(--color-valley-green)]"
        >
          Privacy
        </a>
      </div>
    </footer>
  );
}
