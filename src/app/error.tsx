"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary — catches any unhandled error in the route tree.
 * Provides a branded fallback with retry + dashboard CTA.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[ROOT_ERROR]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            Robust <span className="text-brand-bold">Devs</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong on our end.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 text-left shadow-[var(--ds-shadow-raised)]">
          <p className="text-sm font-medium mb-2">
            We could not load this page.
          </p>
          <p className="text-xs text-muted-foreground break-words">
            {error.message || "Unknown error"}
            {error.digest ? ` (ref: ${error.digest})` : ""}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
