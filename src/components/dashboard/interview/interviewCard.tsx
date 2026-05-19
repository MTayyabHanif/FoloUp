import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, Copy, CopyCheck, PauseCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  formatDurationLabel,
  formatResponseTime,
  getWorkflowToneClasses,
  type HiringWorkflowSummary,
} from "@/lib/hiring-workflow";

interface Props {
  workflow: HiringWorkflowSummary;
}

const baseUrl = process.env.NEXT_PUBLIC_LIVE_URL;

function InterviewCard({ workflow }: Props) {
  const [copied, setCopied] = useState(false);

  const link = workflow.interview.readable_slug
    ? `${baseUrl}/call/${workflow.interview.readable_slug}`
    : (workflow.interview.url ?? "");

  const copyToClipboard = () => {
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true);
        toast.success("Interview link copied.", {
          position: "bottom-right",
          duration: 2500,
        });
        window.setTimeout(() => setCopied(false), 1800);
      },
      (error) => {
        console.error("failed to copy", error?.message);
      },
    );
  };

  const handleJumpToInterview = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    const interviewUrl = workflow.interview.readable_slug
      ? `/call/${workflow.interview.readable_slug}`
      : `/call/${workflow.interview.url}`;
    window.open(interviewUrl, "_blank");
  };

  return (
    <a
      href={`/interviews/${workflow.interview.id}`}
      className="group flex min-h-[280px] flex-col justify-between rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6 text-[#0a1d08] transition-all hover:-translate-y-0.5 hover:border-[#c5ccb6] hover:bg-[#f6f8ef]"
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-3">
            <div className="inline-flex items-center gap-2">
              <span
                className="inline-flex h-3 w-3 rounded-full border border-white/80"
                style={{ backgroundColor: workflow.identityColor }}
                aria-hidden="true"
              />
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                  workflow.healthTone,
                )}`}
              >
                {workflow.healthLabel}
              </span>
            </div>
            <div>
              <h3 className="line-clamp-2 text-[28px] font-semibold leading-[1.02] tracking-[-0.05em]">
                {workflow.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#53614d]">
                {workflow.objective}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              className="h-9 w-9 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] p-0 text-[#203b14] hover:bg-[#eef4e1]"
              variant="ghost"
              aria-label="Open interview preview"
              onClick={handleJumpToInterview}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            <Button
              className="h-9 w-9 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] p-0 text-[#203b14] hover:bg-[#eef4e1]"
              variant="ghost"
              aria-label={copied ? "Link copied" : "Copy interview link"}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                copyToClipboard();
              }}
            >
              {copied ? (
                <CopyCheck className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[20px] border border-[#e0e5d5] bg-[#f7f9f1] px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
              Pipeline
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              {workflow.totalResponses}
            </p>
            <p className="mt-1 text-xs text-[#53614d]">
              {workflow.selectedCount} selected, {workflow.potentialCount} potential
            </p>
          </div>
          <div className="rounded-[20px] border border-[#e0e5d5] bg-[#f7f9f1] px-4 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
              Next action
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
              {workflow.attentionCount}
            </p>
            <p className="mt-1 text-xs text-[#53614d]">
              live or review blockers waiting on a recruiter
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {workflow.stageGroups
            .filter((group) => group.count > 0)
            .slice(0, 4)
            .map((group) => (
              <span
                key={group.key}
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                  group.tone,
                )}`}
              >
                {group.label} {group.count}
              </span>
            ))}
        </div>
      </div>

      <div className="mt-6 space-y-4 border-t border-[#e0e5d5] pt-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 overflow-hidden rounded-full border border-[#e0e5d5] bg-[#eef4e1]">
              {workflow.interviewer?.image ? (
                <Image
                  src={workflow.interviewer.image}
                  alt={workflow.interviewer.name}
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[#203b14]">
                  {(workflow.interviewer?.name ?? "AI").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {workflow.interviewer?.name ?? "AI interviewer"}
              </p>
              <p className="truncate text-sm text-[#53614d]">
                {formatDurationLabel(workflow.durationMinutes)} · {workflow.questionCount} questions
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-[#53614d]">
            {workflow.interview.is_active ? (
              <span className="inline-flex items-center gap-1">
                <PlayCircle className="h-4 w-4 text-[#203b14]" />
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <PauseCircle className="h-4 w-4 text-[#8b6d4d]" />
                Paused
              </span>
            )}
            <p className="mt-2">
              {workflow.recentCandidate
                ? `Latest activity ${formatResponseTime(workflow.recentCandidate.createdAt)}`
                : "No candidate activity yet"}
            </p>
          </div>
        </div>

        <p className="text-sm leading-6 text-[#53614d]">
          {workflow.topCandidate
            ? `${workflow.topCandidate.displayName} is the strongest current signal${workflow.topCandidate.score !== null ? ` with a score of ${workflow.topCandidate.score}` : ""}.`
            : workflow.healthSummary}
        </p>
      </div>
    </a>
  );
}

export default InterviewCard;
