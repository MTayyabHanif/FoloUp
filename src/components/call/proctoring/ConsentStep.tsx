"use client";

import { Camera, Mic, MonitorPlay } from "lucide-react";
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

/**
 * Build the consent body text dynamically based on the interview's
 * proctoring toggles. Microphone is ALWAYS part of the disclosure
 * (required for any audio interview); camera and screen are added when
 * the recruiter enabled them. The ConsentStep only renders when at least
 * one proctoring toggle is on (proctoringActive in the parent), so a
 * mic-only variant is unreachable in practice — but the function handles
 * it defensively.
 */
function consentBody(cameraEnabled: boolean, screenEnabled: boolean): string {
  const intro = "This interview will be recorded. With your permission, we'll";
  const outro =
    "Recordings are reviewed only by the hiring team and are automatically deleted after 90 days.";

  const parts: string[] = ["record your microphone audio"];
  if (cameraEnabled) parts.push("capture your camera feed");
  if (screenEnabled) parts.push("capture a view of your screen");

  // Oxford-comma join for 3+ items; "X and Y" for 2; "X" alone for 1.
  let modalities: string;
  if (parts.length === 1) {
    modalities = parts[0];
  } else if (parts.length === 2) {
    modalities = `${parts[0]} and ${parts[1]}`;
  } else {
    modalities = `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  }

  return `${intro} ${modalities} during the session. ${outro}`;
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

      <div className="grid gap-3 md:grid-cols-3">
        {/* Microphone disclosed alongside camera/screen so the candidate
            sees all permission prompts originating from a single Continue
            click, instead of stacking at the Start-interview click. */}
        {renderNoteCard({
          title: "Microphone",
          icon: <Mic className="h-5 w-5" />,
          body: "Used for the interview audio. Your browser will ask permission after you continue.",
        })}
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
