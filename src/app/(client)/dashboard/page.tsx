"use client";

import { AlertTriangle, ArrowRight, Gem, Play, Plus, Search } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { useState } from "react";

import Modal from "@/components/dashboard/Modal";
import CreateInterviewCard from "@/components/dashboard/interview/createInterviewCard";
import { useJobWorkflows } from "@/components/jobs/use-job-workflows";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataGrid, PageHeader, PageShell, Section } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { formatResponseTime, getWorkflowToneClasses } from "@/lib/hiring-workflow";

function InterviewsLoader() {
  const metricSkeletons = ["live", "review", "shortlist", "jobs"] as const;
  const cardSkeletons = [
    "workflow-1",
    "workflow-2",
    "workflow-3",
    "workflow-4",
    "workflow-5",
    "workflow-6",
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricSkeletons.map((key) => (
          <Skeleton key={key} className="h-32 rounded-[24px]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Skeleton className="h-56 rounded-[24px]" />
        <Skeleton className="h-56 rounded-[24px]" />
      </div>
      <DataGrid cols="3">
        {cardSkeletons.map((key) => (
          <Skeleton key={key} className="h-56 rounded-[24px]" />
        ))}
      </DataGrid>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#e0e5d5] bg-[#f6f8ef] p-6 text-[#0a1d08]">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[#53614d]">{detail}</p>
    </div>
  );
}

function CommandCenterPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-[#e0e5d5] bg-[#f8faF2] p-6 text-[#0a1d08]">
      <div className="border-b border-[#e0e5d5] pb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">{title}</p>
        <p className="mt-2 text-sm leading-6 text-[#53614d]">{description}</p>
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    allowedResponsesCount,
    isLoading,
    isOverQuota,
    liveSessions,
    reviewQueue,
    summary,
    workflows,
  } = useJobWorkflows();
  const hasNoJobs = !isLoading && workflows.length === 0 && !isOverQuota;

  return (
    <PageShell className="pb-12">
      <PageHeader
        eyebrow="Recruiter workspace"
        title="Attention first"
        description="The top signals that should shape today’s recruiting decisions."
      />

      {isOverQuota ? (
        <Banner
          tone="warning"
          title="Response limit reached"
          description={`You have used ${allowedResponsesCount} responses on the free plan. Upgrade to keep candidate sessions open and continue reviewing jobs.`}
          action={
            <Button
              className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
              onClick={() => setIsModalOpen(true)}
            >
              Upgrade
            </Button>
          }
        />
      ) : null}

      {isLoading ? (
        <InterviewsLoader />
      ) : hasNoJobs ? (
        <EmptyState
          icon={<Plus className="h-6 w-6" />}
          title="No hiring workflows yet"
          description="Create your first job and this space will start surfacing pipeline health, live sessions, and candidate decisions."
          action={<CreateInterviewCard />}
        />
      ) : (
        <>
          <Section>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Live sessions"
                value={summary.liveSessions}
                detail={
                  summary.liveSessions > 0
                    ? "Candidates are interviewing right now."
                    : "No active sessions at the moment."
                }
              />
              <MetricCard
                label="Needs review"
                value={summary.reviewQueue}
                detail="Completed sessions waiting on recruiter judgment."
              />
              <MetricCard
                label="Shortlist"
                value={summary.shortlistedCandidates}
                detail="Potential and selected candidates across all jobs."
              />
              <MetricCard
                label="Active jobs"
                value={summary.activeJobs}
                detail={`${summary.pausedJobs} paused ${summary.pausedJobs === 1 ? "workflow" : "workflows"} still available for follow-up.`}
              />
            </div>
          </Section>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <CommandCenterPanel
              title="Live sessions"
              description="See which candidates are currently speaking with an interviewer."
            >
              {liveSessions.length > 0 ? (
                liveSessions.slice(0, 5).map(({ workflow, candidate }) => (
                  <a
                    key={candidate.callId}
                    href={`/jobs/${workflow.interview.id}?call=${candidate.callId}`}
                    className="flex items-start justify-between gap-4 rounded-[20px] border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-4 transition-colors hover:border-[#c5ccb6] hover:bg-[#f3f7ea]"
                  >
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#203b14]" />
                        <p className="truncate text-sm font-semibold text-[#0a1d08]">
                          {candidate.displayName}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-sm text-[#53614d]">{workflow.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[#53614d]">{candidate.summary}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                          workflow.healthTone,
                        )}`}
                      >
                        Live now
                      </span>
                      <p className="mt-3 text-xs text-[#6f7866]">
                        Started {formatResponseTime(candidate.createdAt)}
                      </p>
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-[#d8ddd0] bg-[#fbfdf6] px-5 py-8 text-sm text-[#53614d]">
                  Sessions will appear here as soon as candidates enter a live interview.
                </div>
              )}
            </CommandCenterPanel>

            <CommandCenterPanel
              title="Review queue"
              description="The sharpest bottlenecks waiting for a recruiter decision."
            >
              {reviewQueue.length > 0 ? (
                reviewQueue.slice(0, 5).map(({ workflow, candidate }) => (
                  <a
                    key={candidate.callId}
                    href={`/jobs/${workflow.interview.id}?call=${candidate.callId}`}
                    className="flex items-center justify-between gap-4 rounded-[20px] border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-4 transition-colors hover:border-[#c5ccb6] hover:bg-[#f6f8ef]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0a1d08]">
                        {candidate.displayName}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#53614d]">{workflow.title}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                          candidate.stage === "interrupted" ? "critical" : "warning",
                        )}`}
                      >
                        {candidate.stage === "interrupted" ? "Interrupted" : "Needs review"}
                      </span>
                      <p className="mt-2 text-xs text-[#6f7866]">
                        {candidate.score !== null ? `Score ${candidate.score}` : "Analysis pending"}
                      </p>
                    </div>
                  </a>
                ))
              ) : (
                <div className="rounded-[20px] border border-dashed border-[#d8ddd0] bg-[#fbfdf6] px-5 py-8 text-sm text-[#53614d]">
                  New completed sessions will move here until someone reviews them.
                </div>
              )}
            </CommandCenterPanel>
          </div>
        </>
      )}

      {isModalOpen ? (
        <Modal open={isModalOpen} size="2xl" onClose={() => setIsModalOpen(false)}>
          <div className="flex w-full max-w-2xl flex-col space-y-6 rounded-[28px] bg-[#fbfdf6] p-2 text-[#0a1d08]">
            <div className="flex justify-center text-[#4a3212]">
              <Gem />
            </div>
            <div className="space-y-2 text-center">
              <h3 className="text-3xl font-semibold tracking-[-0.04em]">
                Keep the hiring flow open
              </h3>
              <p className="mx-auto max-w-xl text-sm leading-6 text-[#53614d]">
                You have reached the current response allowance for the free plan. Upgrade to
                continue collecting candidates and keep every workflow active.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[0.95fr_1.05fr]">
              <div className="flex items-center justify-center rounded-[24px] border border-[#e0e5d5] bg-[#f6f8ef] p-6">
                <Image src="/premium-plan-icon.png" alt="Premium plan" width={240} height={240} />
              </div>

              <div className="grid gap-4">
                <div className="rounded-[24px] border border-[#e0e5d5] bg-[#f6f8ef] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
                    Free plan
                  </p>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-[#53614d]">
                    <li>10 responses total</li>
                    <li>Basic support</li>
                    <li>Essential workflow reporting</li>
                  </ul>
                </div>
                <div className="rounded-[24px] border border-[#d7c9bb] bg-[#f7efe8] p-5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
                    Pro plan
                  </p>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-[#53614d]">
                    <li>Flexible pay-per-response capacity</li>
                    <li>Priority support</li>
                    <li>Every workflow stays available</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="text-[#53614d]">Contact</span>
              <a
                href="mailto:hi@robustagency.co"
                className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] px-4 py-2 font-semibold text-[#0a1d08] transition-colors hover:border-[#c5ccb6] hover:bg-[#f6f8ef]"
              >
                hi@robustagency.co
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}

export default DashboardPage;
