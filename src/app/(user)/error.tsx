"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Candidate-flow error boundary — different UX from the recruiter side:
 * - No "Back to dashboard" link (candidates aren't Robust Devs Hiring users)
 * - Friendlier copy; assumes the candidate is in a high-stakes moment (interview)
 */
export default function CandidateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[CANDIDATE_ERROR]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">
            Robust <span className="text-brand-bold">Devs Hiring</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong loading your interview.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6 text-left shadow-[var(--ds-shadow-raised)]">
          <p className="text-sm">
            Please try again. If this keeps happening, contact the person who
            shared this interview with you.
          </p>
          {error.digest ? (
            <p className="text-xs text-muted-foreground mt-2">
              Reference: {error.digest}
            </p>
          ) : null}
        </div>

        <Button onClick={reset} variant="default">
          Retry
        </Button>
      </div>
    </div>
  );
}
