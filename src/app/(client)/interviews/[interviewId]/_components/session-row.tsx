"use client";

import { PlayCircle } from "lucide-react";
import Link from "next/link";

import {
  type StageGroup,
  type WorkflowCandidate,
  formatResponseTime,
  getWorkflowToneClasses,
} from "@/lib/hiring-workflow";

type SessionRowProps = {
  candidate: WorkflowCandidate;
  interviewId: string;
  basePath?: string;
  isSelected: boolean;
  stageMeta?: Pick<StageGroup, "label" | "tone">;
  onSelect: (candidate: WorkflowCandidate) => void;
};

export function SessionRow({
  candidate,
  interviewId,
  basePath = "/interviews",
  isSelected,
  stageMeta,
  onSelect,
}: SessionRowProps) {
  const isUnopened = !candidate.isViewed && candidate.status !== "ongoing";
  const isLive = candidate.status === "ongoing";

  return (
    <Link
      href={`${basePath}/${interviewId}?call=${candidate.callId}`}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button === 1
        ) {
          return;
        }
        event.preventDefault();
        onSelect(candidate);
      }}
      className={`flex w-full items-start justify-between gap-3 rounded-[18px] border px-4 py-3 text-left transition-colors ${
        isSelected
          ? "border-[#203b14] bg-[#eef4e1]"
          : "border-[#e0e5d5] bg-[#f8faf3] hover:border-[#c5ccb6] hover:bg-[#f3f7ea]"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[#0a1d08]">{candidate.displayName}</p>
          {isLive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#203b14] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#fbfdf6]">
              <PlayCircle className="h-3 w-3" />
              Live
            </span>
          ) : null}
          {isUnopened ? (
            <span className="inline-flex h-2 w-2 rounded-full bg-[#4a3212]" aria-label="Unopened" />
          ) : null}
        </div>
        <p className="mt-1 line-clamp-1 text-xs leading-5 text-[#53614d]">{candidate.summary}</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-[#6f7866]">
          {stageMeta ? (
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getWorkflowToneClasses(
                stageMeta.tone,
              )}`}
            >
              {stageMeta.label}
            </span>
          ) : null}
          <span>{formatResponseTime(candidate.createdAt)}</span>
        </div>
      </div>
      <div className="shrink-0">
        {candidate.score !== null ? (
          <span className="inline-flex rounded-full border border-[#c5ccb6] bg-[#fbfdf6] px-3 py-1 text-xs font-semibold text-[#0a1d08]">
            {candidate.score}
          </span>
        ) : (
          <span className="inline-flex rounded-full border border-[#d8ddd0] bg-[#fbfdf6] px-3 py-1 text-[11px] font-medium text-[#6f7866]">
            Pending
          </span>
        )}
      </div>
    </Link>
  );
}

export default SessionRow;
