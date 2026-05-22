"use client";

import { MonitorPlay } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export type ScreenShareOutcome =
  | { kind: "granted"; stream: MediaStream; displaySurface: "monitor" }
  | { kind: "unsupported" }
  | { kind: "exit" };

export type ScreenShareGateProps = {
  /** Called when full-screen share is acquired (or unsupported, soft-flag). */
  onResolved: (outcome: ScreenShareOutcome) => void;
  /**
   * Called immediately before AND after each getDisplayMedia invocation so
   * the parent can suppress tab-switch detection during the picker.
   */
  onPickerOpening?: () => void;
  onPickerClosed?: () => void;
};

/**
 * Pre-start screen-share gate.
 *
 * - Soft-flag if getDisplayMedia is unsupported (returns kind: "unsupported")
 * - Hard-gate if displaySurface is not "monitor" — releases the stream and
 *   asks the candidate to re-share
 * - After the first failed attempt, shows an "Exit the interview" escape
 *   hatch link that routes the candidate to a StatusPanel without creating
 *   a response row (see design.md §10.6)
 * - Cleans up locally-held streams on unmount
 */
export function ScreenShareGate({
  onResolved,
  onPickerOpening,
  onPickerClosed,
}: ScreenShareGateProps) {
  const [error, setError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const heldStreamRef = useRef<MediaStream | null>(null);
  const hasResolvedRef = useRef(false);

  // Cleanup any locally-held stream on unmount (e.g., candidate closes the
  // tab between picker close and onResolved).
  useEffect(() => {
    return () => {
      const s = heldStreamRef.current;
      if (s) {
        s.getTracks().forEach((t) => t.stop());
        heldStreamRef.current = null;
      }
    };
  }, []);

  const request = async () => {
    if (isRequesting) return;
    setError(null);
    setIsRequesting(true);

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getDisplayMedia !== "function"
    ) {
      hasResolvedRef.current = true;
      setIsRequesting(false);
      onResolved({ kind: "unsupported" });

      return;
    }

    onPickerOpening?.();
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
    } catch {
      // Picker dismissed or permission denied.
      setAttemptCount((n) => n + 1);
      setError(
        "Please share your full screen, not a window or tab. In the picker, look for 'Entire Screen' or 'Display 1' and select it.",
      );
      // Defer the clear so it outlives the visibilitychange event fired by
      // picker close — see design.md §3 (tab-switch suppression timing).
      setTimeout(() => onPickerClosed?.(), 0);
      setIsRequesting(false);

      return;
    }
    setTimeout(() => onPickerClosed?.(), 0);

    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    const displaySurface = (settings as { displaySurface?: string }).displaySurface;

    if (displaySurface !== "monitor") {
      // Release the rejected stream BEFORE re-prompting so the OS picker
      // indicator clears and the candidate sees a fresh prompt.
      stream.getTracks().forEach((t) => t.stop());
      setAttemptCount((n) => n + 1);
      setError(
        "That looks like a window or tab. Please choose 'Entire Screen' or 'Display 1' instead.",
      );
      setIsRequesting(false);

      return;
    }

    heldStreamRef.current = stream;
    hasResolvedRef.current = true;
    setIsRequesting(false);
    onResolved({ kind: "granted", stream, displaySurface: "monitor" });
  };

  return (
    <div className="space-y-6 px-6 py-8 md:px-8 md:py-10">
      <div className="rounded-[24px] border border-[#e0e5d5] bg-white/80 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#d7e8b5]/45 text-[#203b14]">
            <MonitorPlay className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-[#203b14]">
              Share your screen
            </h3>
            <p className="text-sm leading-6 text-[#31200b]/78">
              When the browser asks, choose your <strong>full screen</strong>{" "}
              (not a window or browser tab). The recording is reviewed only by
              the hiring team.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div
          className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="h-12 flex-1 rounded-full bg-[#4a3212] text-base font-medium text-[#fbfdf6] hover:bg-[#31200b] disabled:opacity-50"
          disabled={isRequesting}
          onClick={request}
        >
          {isRequesting ? "Waiting for picker…" : "Share full screen"}
        </Button>
      </div>

      {attemptCount > 0 ? (
        <p className="text-center text-sm text-[#31200b]/70">
          Can&apos;t share your screen?{" "}
          <button
            type="button"
            className="underline underline-offset-4 hover:text-[#203b14]"
            onClick={() => {
              hasResolvedRef.current = true;
              onResolved({ kind: "exit" });
            }}
          >
            Exit the interview
          </button>
        </p>
      ) : null}
    </div>
  );
}
