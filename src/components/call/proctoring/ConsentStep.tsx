"use client";

import { Camera, MonitorPlay } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";

export type ConsentStepProps = {
  cameraEnabled: boolean;
  screenEnabled: boolean;
  /** Optional support email surfaced in the decline path StatusPanel via parent. */
  organizationSupportEmail?: string | null;
  /** Inner-content renderer for NoteCard items; parent supplies the styled component */
  renderNoteCard: (args: {
    title: string;
    icon: ReactNode;
    body: ReactNode;
  }) => ReactNode;
  /** Called with the ISO timestamp when the candidate consents and continues */
  onConsent: (acknowledgedAt: string) => void;
  /** Called when the candidate clicks "I don't consent" — parent routes to StatusPanel */
  onDecline: () => void;
};

function consentBody(cameraEnabled: boolean, screenEnabled: boolean): string {
  if (cameraEnabled && screenEnabled) {
    return "This interview includes recording. With your permission, we'll capture your camera feed and a view of your screen during the session. Recordings are reviewed only by the hiring team and are automatically deleted after 90 days.";
  }
  if (cameraEnabled) {
    return "This interview includes recording. With your permission, we'll capture your camera feed during the session. Recordings are reviewed only by the hiring team and are automatically deleted after 90 days.";
  }

  return "This interview includes recording. With your permission, we'll capture a view of your screen during the session. Recordings are reviewed only by the hiring team and are automatically deleted after 90 days.";
}

/**
 * Inner content for the proctoring consent step. Render inside the parent
 * <CandidateFrame /> so we inherit the consistent multi-step layout.
 *
 * No-row-creation policy: this component never creates a response row.
 * On decline, the parent routes to a StatusPanel without invoking
 * register-call / createResponse — see openspec design.md §9.5.
 */
export function ConsentStep({
  cameraEnabled,
  screenEnabled,
  renderNoteCard,
  onConsent,
  onDecline,
}: ConsentStepProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="space-y-6 px-6 py-8 md:px-8 md:py-10">
      <p className="text-sm leading-7 text-[#31200b]/78 md:text-base">
        {consentBody(cameraEnabled, screenEnabled)}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        {cameraEnabled
          ? renderNoteCard({
              title: "Camera",
              icon: <Camera className="h-5 w-5" />,
              body: "A small self-view will appear during the interview so you can confirm the recording is live.",
            })
          : null}
        {screenEnabled
          ? renderNoteCard({
              title: "Screen",
              icon: <MonitorPlay className="h-5 w-5" />,
              body: "You'll be asked to share your full screen (not a single window) before the interview begins.",
            })
          : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-[20px] border border-[#e0e5d5] bg-white/80 p-4 text-sm leading-6 text-[#0a1d08]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-[#c5ccb6] text-[#203b14] focus:ring-[#203b14]"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I understand this session will be recorded and agree to proceed.</span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          className="h-12 flex-1 rounded-full bg-[#4a3212] text-base font-medium text-[#fbfdf6] hover:bg-[#31200b] disabled:opacity-50"
          disabled={!agreed}
          onClick={() => onConsent(new Date().toISOString())}
        >
          Continue
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-full border-[#e0e5d5] bg-[#fbfdf6] px-6 text-[#0a1d08] hover:border-[#203b14] hover:text-[#203b14]"
          onClick={onDecline}
        >
          I don&apos;t consent
        </Button>
      </div>
    </div>
  );
}
