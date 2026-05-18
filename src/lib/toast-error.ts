"use client";

import { toast } from "sonner";

/**
 * Shared toast helpers introduced by change #3 wave 2.
 *
 * Replaces the pervasive `console.log(error); return []` pattern in services
 * (services now re-throw) with explicit UI-side error surfacing.
 *
 * Pattern:
 *   try {
 *     const result = await SomeService.action(payload);
 *     toastSuccess("Action complete");
 *   } catch (err) {
 *     toastError(err, "Could not complete action");
 *   }
 *
 * Services must NOT call these helpers directly — they run server-side too
 * (route handlers). Sonner is client-only.
 */

export function toastError(err: unknown, fallback: string): void {
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : undefined;

  toast.error(fallback, {
    description: detail && detail !== fallback ? detail : undefined,
  });
}

export function toastSuccess(message: string, description?: string): void {
  toast.success(message, { description });
}
