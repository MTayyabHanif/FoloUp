"use client";

import { AlertCircle, ArrowRight, Sparkles, TimerReset } from "lucide-react";

import DataTable, {
  type TableData,
} from "@/components/dashboard/interview/dataTable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import {
  convertSecondstoMMSS,
} from "@/lib/utils";
import {
  formatDurationLabel,
  formatResponseTime,
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
  const tableData: TableData[] = workflow.responses.map((candidate) => ({
    call_id: candidate.callId,
    name: candidate.displayName,
    overallScore: candidate.score ?? 0,
    communicationScore: candidate.response.analytics?.communication?.score ?? 0,
    callSummary: candidate.summary,
  }));

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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
          <div className="flex items-end justify-between gap-4 border-b border-[#e0e5d5] pb-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
                Ranked candidates
              </p>
              <p className="mt-2 text-sm leading-6 text-[#53614d]">
                Strongest current signals across the job workflow.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {workflow.responses.slice(0, 4).map((candidate) => (
              <button
                key={candidate.callId}
                type="button"
                className="flex w-full items-center justify-between gap-4 rounded-[20px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-4 text-left transition-colors hover:border-[#c5ccb6] hover:bg-[#f3f7ea]"
                onClick={() => onOpenCandidate(candidate.callId)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0a1d08]">
                    {candidate.displayName}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#53614d]">
                    {candidate.summary}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                      workflow.stageGroups.find(
                        (group) => group.key === candidate.stage,
                      )?.tone ?? "default",
                    )}`}
                  >
                    {workflow.stageGroups.find((group) => group.key === candidate.stage)
                      ?.label ?? "Candidate"}
                  </span>
                  <p className="mt-2 text-sm font-semibold text-[#0a1d08]">
                    {candidate.score !== null ? `Score ${candidate.score}` : "Awaiting analysis"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
          <div className="flex items-end justify-between gap-4 border-b border-[#e0e5d5] pb-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
                Pipeline health
              </p>
              <p className="mt-2 text-sm leading-6 text-[#53614d]">
                Read the workflow as a queue of decisions, not a flat list of responses.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {workflow.stageGroups
              .filter((group) => group.count > 0)
              .map((group) => (
                <div
                  key={group.key}
                  className="rounded-[20px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#0a1d08]">
                        {group.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#53614d]">
                        {group.description}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                        group.tone,
                      )}`}
                    >
                      {group.count}
                    </span>
                  </div>
                </div>
              ))}

            <div className="rounded-[20px] border border-dashed border-[#d8ddd0] bg-[#f6f8ef] px-4 py-4 text-sm leading-6 text-[#53614d]">
              <div className="inline-flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 text-[#4a3212]" />
                <p>
                  {workflow.healthSummary} {workflow.viewedPendingCount > 0
                    ? `${workflow.viewedPendingCount} finished candidate${workflow.viewedPendingCount === 1 ? "" : "s"} remain unseen by the recruiter.`
                    : "Every finished session has already been opened at least once."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
        <div className="flex flex-col gap-3 border-b border-[#e0e5d5] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
              Candidate table
            </p>
            <p className="mt-2 text-sm leading-6 text-[#53614d]">
              Sort candidates by score or communication, then jump straight into the full response detail.
            </p>
          </div>
          {workflow.recentCandidate ? (
            <p className="inline-flex items-center gap-2 text-sm text-[#53614d]">
              <TimerReset className="h-4 w-4" />
              Latest activity {formatResponseTime(workflow.recentCandidate.createdAt)}
            </p>
          ) : null}
        </div>

        <div className="mt-5 rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] p-2">
          <ScrollArea className="max-h-[520px]">
            <DataTable data={tableData} interviewId={workflow.interview.id} />
          </ScrollArea>
        </div>

        {workflow.topCandidate ? (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-[22px] border border-[#e0e5d5] bg-[#f6f8ef] px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-[#0a1d08]">
                Strongest current signal: {workflow.topCandidate.displayName}
              </p>
              <p className="mt-1 text-sm leading-6 text-[#53614d]">
                {workflow.topCandidate.summary}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-sm font-semibold text-[#0a1d08] transition-colors hover:border-[#c5ccb6] hover:bg-[#eef4e1]"
              onClick={() => onOpenCandidate(workflow.topCandidate!.callId)}
            >
              Open candidate
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default SummaryInfo;
