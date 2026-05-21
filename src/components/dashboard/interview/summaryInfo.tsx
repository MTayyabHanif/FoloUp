"use client";

import { AlertCircle, ArrowRight, Sparkles } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import {
  convertSecondstoMMSS,
} from "@/lib/utils";
import {
  formatDurationLabel,
  getWorkflowToneClasses,
  type HiringWorkflowSummary,
} from "@/lib/hiring-workflow";

type SummaryProps = {
  workflow: HiringWorkflowSummary;
  onOpenCandidate: (callId: string) => void;
};

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#53614d]">{detail}</p>
    </div>
  );
}

function SummaryInfo({ workflow, onOpenCandidate }: SummaryProps) {
  if (workflow.totalResponses === 0) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-[#d8ddd0] bg-[#f6f8ef] px-6 py-10">
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="This job is ready for candidates"
          description="Share the interview link to start collecting sessions. As candidates complete interviews, this workspace will surface live momentum, review queues, and strongest signals."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#0a1d08]">
      <div className="rounded-[28px] border border-[#e0e5d5] bg-[#f6f8ef] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2">
              <span
                className="inline-flex h-3 w-3 rounded-full border border-white/80"
                style={{ backgroundColor: workflow.identityColor }}
              />
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                  workflow.healthTone,
                )}`}
              >
                {workflow.healthLabel}
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-[-0.05em]">
              {workflow.title}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#53614d]">
              {workflow.description}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#e0e5d5] bg-[#fbfdf6] px-5 py-4 text-sm leading-6 text-[#53614d]">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
              Role setup
            </p>
            <p className="mt-3">
              {workflow.interviewer?.name ?? "AI interviewer"} leads a{" "}
              {formatDurationLabel(workflow.durationMinutes).toLowerCase()} session
              across {workflow.questionCount} questions.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric
            label="Completion rate"
            value={`${workflow.completionRate}%`}
            detail="Candidates who reached a completed session state."
          />
          <SummaryMetric
            label="Average score"
            value={workflow.avgScore ?? "—"}
            detail="Mean hiring score across analyzed candidates."
          />
          <SummaryMetric
            label="Average duration"
            value={
              workflow.avgDurationSeconds
                ? convertSecondstoMMSS(workflow.avgDurationSeconds)
                : "—"
            }
            detail="Typical time candidates spend with this interviewer."
          />
          <SummaryMetric
            label="Analysis pending"
            value={workflow.analysisPendingCount}
            detail="Sessions still waiting for a full insight payload."
          />
        </div>
      </div>
    </div>
  );
}

export default SummaryInfo;
