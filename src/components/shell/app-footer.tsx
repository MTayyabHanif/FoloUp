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
    <footer className="mt-auto border-t bg-card px-6 py-4 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
        <p>
          © {year}{" "}
          <span className="font-semibold text-foreground">
            Robust <span className="text-brand-bold">Devs</span>
          </span>
          . All rights reserved.
        </p>
        <nav aria-label="Footer" className="flex items-center gap-4">
          <a
            href={marketingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Marketing site
          </a>
          <a
            href={`${marketingUrl.replace(/\/$/, "")}/privacy`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Privacy
          </a>
          <a
            href={`${marketingUrl.replace(/\/$/, "")}/terms`}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Terms
          </a>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-foreground"
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
    <footer className="border-t bg-background py-4 text-center text-xs text-muted-foreground">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-4 sm:flex-row sm:justify-center sm:gap-3">
        <span>
          Powered by{" "}
          <a
            href={marketingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-foreground transition-colors hover:opacity-80"
          >
            Robust <span className="text-brand-bold">Devs</span>
          </a>
        </span>
        <span className="hidden text-muted-foreground/40 sm:inline">·</span>
        <a
          href={`${marketingUrl.replace(/\/$/, "")}/privacy`}
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
        >
          Privacy
        </a>
      </div>
    </footer>
  );
}
