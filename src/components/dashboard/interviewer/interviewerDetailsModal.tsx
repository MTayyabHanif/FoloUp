"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { Copy, CopyCheck, Mic2 } from "lucide-react";
import ReactAudioPlayer from "react-audio-player";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Interviewer } from "@/types/interviewer";
import { VOICE_OPTIONS } from "@/lib/constants";

interface Props {
  interviewer: Interviewer | undefined;
}

const VOICE_LABELS = Object.fromEntries(
  VOICE_OPTIONS.map((voice) => [voice.id, voice.label]),
);

const TRAITS = [
  {
    key: "empathy",
    label: "Empathy",
    describe: (value: number) =>
      value >= 8
        ? "Creates a warm, reassuring tone."
        : value >= 5
          ? "Balances empathy with structure."
          : "Keeps emotional distance and clarity.",
  },
  {
    key: "rapport",
    label: "Rapport",
    describe: (value: number) =>
      value >= 8
        ? "Builds quick conversational trust."
        : value >= 5
          ? "Feels approachable but grounded."
          : "Maintains a more formal interview stance.",
  },
  {
    key: "exploration",
    label: "Exploration",
    describe: (value: number) =>
      value >= 8
        ? "Pushes for depth, nuance, and specifics."
        : value >= 5
          ? "Uses selective follow-up to surface signal."
          : "Stays close to the planned path.",
  },
  {
    key: "speed",
    label: "Pace",
    describe: (value: number) =>
      value >= 8
        ? "Moves quickly and keeps momentum high."
        : value >= 5
          ? "Keeps a calm, steady cadence."
          : "Leaves more pauses and thinking space.",
  },
] as const;

function InterviewerDetailsModal({ interviewer }: Props) {
  const [copied, setCopied] = useState(false);

  const prompt = interviewer?.prompt ?? "";
  const promptRows = Math.min(24, Math.max(8, prompt.split("\n").length + 2));
  const voiceLabel = interviewer?.voice_id
    ? VOICE_LABELS[interviewer.voice_id] ?? interviewer.voice_id
    : "Voice not set";

  const handleCopyPrompt = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!prompt) {
      return;
    }

    navigator.clipboard.writeText(prompt).then(
      () => {
        setCopied(true);
        toast.success("Prompt copied", {
          position: "bottom-right",
          duration: 2000,
        });
        window.setTimeout(() => setCopied(false), 1500);
      },
      (err) => {
        console.error("failed to copy prompt", err);
        toast.error("Failed to copy prompt", {
          position: "bottom-right",
          duration: 3000,
        });
      },
    );
  };

  return (
    <div className="flex w-full flex-col gap-6 text-[#0a1d08]">
      <section className="overflow-hidden rounded-[32px] border border-[#dfe4d4] bg-[#f8fbf0]">
        <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="relative min-h-[240px] border-b border-[#e0e5d5] md:border-b-0 md:border-r">
            <Image
              src={interviewer?.image || ""}
              alt={`${interviewer?.name ?? "Interviewer"} portrait`}
              sizes="220px"
              className="object-cover object-center"
              fill
            />
          </div>
          <div className="p-6 md:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#203b14]">
              <Mic2 className="h-3.5 w-3.5" />
              {voiceLabel}
            </div>
            <div className="mt-4 space-y-3">
              <h2 className="text-3xl font-semibold tracking-[-0.05em] text-[#0a1d08]">
                {interviewer?.name}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-[#42513d]">
                {interviewer?.description}
              </p>
            </div>

            {interviewer?.audio ? (
              <div className="mt-6 rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  Voice sample
                </p>
                <ReactAudioPlayer
                  src={`/audio/${interviewer.audio}`}
                  className="mt-3 w-full"
                  controls
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5 md:p-6">
        <div className="mb-5 space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b7568]">
            Conversation profile
          </p>
          <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0a1d08]">
            Visible trait metadata
          </h3>
          <p className="text-sm leading-6 text-[#42513d]">
            These settings remain descriptive metadata for recruiters. They help
            explain the persona’s interviewing stance at a glance.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {TRAITS.map((trait) => {
            const value = interviewer?.[trait.key] ?? 5;

            return (
              <div
                key={trait.key}
                className="rounded-[22px] border border-[#e0e5d5] bg-[#f8fbf0] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#0a1d08]">
                    {trait.label}
                  </span>
                  <span className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-sm text-[#203b14]">
                    {value}
                  </span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-[#edf1e3]">
                  <div
                    className="h-full rounded-full bg-[#203b14]"
                    style={{ width: `${Math.max(10, (value / 10) * 100)}%` }}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-[#5e6958]">
                  {trait.describe(value)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b7568]">
              Prompt composition
            </p>
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0a1d08]">
              Persona script
            </h3>
            <p className="text-sm leading-6 text-[#42513d]">
              The stored prompt defines how this interviewer opens, probes, and
              keeps the conversation on track.
            </p>
          </div>

          {prompt ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    aria-label={copied ? "Prompt copied" : "Copy prompt"}
                    onClick={handleCopyPrompt}
                  >
                    {copied ? <CopyCheck size={15} /> : <Copy size={15} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {copied ? "Copied" : "Copy prompt"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>

        {prompt ? (
          <Textarea
            value={prompt}
            rows={promptRows}
            className="mt-5 resize-none rounded-[22px] border-[#dfe4d4] bg-[#f8fbf0] font-mono text-xs leading-6"
            readOnly
          />
        ) : (
          <p className="mt-5 rounded-[22px] border border-dashed border-[#c5ccb6] bg-[#f8fbf0] p-4 text-sm leading-6 text-[#5e6958]">
            No prompt is stored for this persona yet. Existing CRUD behavior is
            unchanged; once a prompt is present it will appear here in full.
          </p>
        )}
      </section>
    </div>
  );
}

export default InterviewerDetailsModal;
