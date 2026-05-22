"use client";

import { AlertTriangle } from "lucide-react";

export type RevokedStream = "camera" | "screen";

export type RevocationBannerProps = {
  revokedStreams: RevokedStream[];
};

function bannerCopy(revoked: RevokedStream[]): string | null {
  const set = new Set(revoked);
  if (set.has("camera") && set.has("screen")) {
    return "Your camera and screen share were stopped. The interview is still in progress — the hiring team has been notified.";
  }
  if (set.has("camera")) {
    return "Your camera was stopped. The interview is still in progress — the hiring team has been notified.";
  }
  if (set.has("screen")) {
    return "Your screen share was stopped. The interview is still in progress — the hiring team has been notified.";
  }

  return null;
}

/**
 * Mid-call revocation banner. Non-dismissible, persists until call end.
 * Renders null when revokedStreams is empty.
 *
 * Visually similar to existing warning patterns in the candidate flow
 * (amber tone, alert-triangle icon). Positioned by the parent above the
 * Retell widget.
 */
export function RevocationBanner({ revokedStreams }: RevocationBannerProps) {
  const message = bannerCopy(revokedStreams);
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}
