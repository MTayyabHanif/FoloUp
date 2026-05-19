"use client";

import Image from "next/image";
import { useState, type MouseEvent } from "react";
import { Copy, CopyCheck } from "lucide-react";
import ReactAudioPlayer from "react-audio-player";
import { toast } from "sonner";

import { CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Interviewer } from "@/types/interviewer";

interface Props {
  interviewer: Interviewer | undefined;
}

/**
 * Per-trait control row. Slider + numeric value to the right.
 */
function TraitControl({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  const normalized = (value ?? 10) / 10;

  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm font-medium text-foreground">
        {label}
      </span>
      <div className="flex-1">
        <Slider value={[normalized]} max={1} step={0.1} />
      </div>
      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {normalized.toFixed(1)}
      </span>
    </div>
  );
}

function InterviewerDetailsModal({ interviewer }: Props) {
  const [copied, setCopied] = useState(false);

  // Dynamic rows formula: at least 6, at most 24, adapting to actual content.
  // The textarea itself does not scroll (resize-none); the modal container's
  // overflow-y-auto provides a single scroll context.
  const prompt = interviewer?.prompt ?? "";
  const promptRows = Math.min(
    24,
    Math.max(6, prompt.split("\n").length + 2),
  );

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
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <header className="text-center">
        <CardTitle className="text-2xl font-semibold">
          {interviewer?.name}
        </CardTitle>
      </header>

      {/* Portrait + description side-by-side at md+, stacked on mobile */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="h-40 w-36 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-secondary">
          <Image
            src={interviewer?.image || ""}
            alt={`${interviewer?.name ?? "Interviewer"} portrait`}
            width={180}
            height={200}
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {interviewer?.description}
          </p>
          {interviewer?.audio && (
            <ReactAudioPlayer
              src={`/audio/${interviewer.audio}`}
              className="w-full"
              controls
            />
          )}
        </div>
      </div>

      {/* Trait sliders */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Interviewer settings
          </h3>
          <p className="text-xs text-muted-foreground">
            Display only — does not affect interview behavior.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3">
          <TraitControl label="Empathy" value={interviewer?.empathy} />
          <TraitControl label="Exploration" value={interviewer?.exploration} />
          <TraitControl label="Rapport" value={interviewer?.rapport} />
          <TraitControl label="Speed" value={interviewer?.speed} />
        </div>
      </section>

      {/* Prompt */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Prompt
          </h3>
          {prompt && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
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
          )}
        </div>
        {prompt ? (
          <Textarea
            value={prompt}
            rows={promptRows}
            className="resize-none font-mono text-xs"
            readOnly
          />
        ) : (
          <p className="rounded-md border border-dashed border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
            No prompt stored for this interviewer. If you just landed this
            change, run <code className="font-mono">migration.sql</code> to
            backfill prompts for the seed interviewers.
          </p>
        )}
      </section>
    </div>
  );
}

export default InterviewerDetailsModal;
