"use client";

import React, { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  AlertTriangle,
  ArrowRight,
  Gem,
  Play,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import Image from "next/image";

import InterviewCard from "@/components/dashboard/interview/interviewCard";
import CreateInterviewCard from "@/components/dashboard/interview/createInterviewCard";
import { InterviewService } from "@/services/interviews.service";
import { ClientService } from "@/services/clients.service";
import { ResponseService } from "@/services/responses.service";
import { useInterviews } from "@/contexts/interviews.context";
import { useInterviewers } from "@/contexts/interviewers.context";
import type { Response } from "@/types/response";
import Modal from "@/components/dashboard/Modal";
import {
  buildCommandCenterSummary,
  buildHiringWorkflowSummary,
  formatResponseTime,
  getWorkflowToneClasses,
  sortWorkflowsForDashboard,
} from "@/lib/hiring-workflow";
import { Button } from "@/components/ui/button";
import {
  PageShell,
  PageHeader,
  Section,
  DataGrid,
} from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";

function InterviewsLoader() {
  const metricSkeletons = [
    "live",
    "review",
    "shortlist",
    "jobs",
  ] as const;
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
          <Skeleton key={key} className="h-72 rounded-[24px]" />
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
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
        {label}
      </p>
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
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
          {title}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#53614d]">{description}</p>
      </div>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function Interviews() {
  const { interviews, interviewsLoading } = useInterviews();
  const { interviewers } = useInterviewers();
  const { organization } = useOrganization();
  const [quotaLoading, setQuotaLoading] = useState<boolean>(false);
  const [workflowLoading, setWorkflowLoading] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [allowedResponsesCount, setAllowedResponsesCount] =
    useState<number>(10);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [responsesByInterview, setResponsesByInterview] = useState<
    Record<string, Response[]>
  >({});

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        if (!organization?.id) {
          return;
        }

        const data = await ClientService.getOrganizationById(organization.id);
        if (data?.plan) {
          setCurrentPlan(data.plan);
          if (data.plan === "free_trial_over") {
            setIsModalOpen(true);
          }
        }
        if (data?.allowed_responses_count) {
          setAllowedResponsesCount(data.allowed_responses_count);
        }
      } catch (error) {
        console.error("Error fetching organization data:", error);
      }
    };

    fetchOrganizationData();
  }, [organization]);

  useEffect(() => {
    const fetchResponsesCount = async () => {
      if (!organization || currentPlan !== "free") {
        return;
      }

      setQuotaLoading(true);
      try {
        const totalResponses =
          await ResponseService.getResponseCountByOrganizationId(
            organization.id,
          );
        const hasExceededLimit = totalResponses >= allowedResponsesCount;
        if (hasExceededLimit) {
          setCurrentPlan("free_trial_over");
          await InterviewService.deactivateInterviewsByOrgId(organization.id);
          await ClientService.updateOrganization(
            { plan: "free_trial_over" },
            organization.id,
          );
        }
      } catch (error) {
        console.error("Error fetching responses:", error);
      } finally {
        setQuotaLoading(false);
      }
    };

    fetchResponsesCount();
  }, [organization, currentPlan, allowedResponsesCount]);

  useEffect(() => {
    let isMounted = true;

    const fetchResponsesForJobs = async () => {
      if (interviewsLoading) {
        return;
      }

      if (interviews.length === 0) {
        setResponsesByInterview({});
        setWorkflowLoading(false);

return;
      }

      setWorkflowLoading(true);
      try {
        const entries = await Promise.all(
          interviews.map(async (interview) => [
            interview.id,
            await ResponseService.getAllResponses(interview.id),
          ]),
        );

        if (!isMounted) {
          return;
        }

        setResponsesByInterview(Object.fromEntries(entries));
      } catch (error) {
        console.error("Error fetching interview responses:", error);
      } finally {
        if (isMounted) {
          setWorkflowLoading(false);
        }
      }
    };

    fetchResponsesForJobs();

    return () => {
      isMounted = false;
    };
  }, [interviews, interviewsLoading]);

  const workflows = sortWorkflowsForDashboard(
    interviews.map((interview) =>
      buildHiringWorkflowSummary({
        interview,
        responses: responsesByInterview[interview.id] ?? [],
        interviewer:
          interviewers.find((item) => item.id === interview.interviewer_id) ??
          null,
      }),
    ),
  );

  const summary = buildCommandCenterSummary(workflows);
  const liveSessions = workflows.flatMap((workflow) =>
    workflow.stageBuckets.live.map((candidate) => ({ workflow, candidate })),
  );
  const reviewQueue = workflows.flatMap((workflow) =>
    [...workflow.stageBuckets.review, ...workflow.stageBuckets.interrupted].map(
      (candidate) => ({
        workflow,
        candidate,
      }),
    ),
  );

  const isOverQuota = currentPlan === "free_trial_over";
  const isLoading = interviewsLoading || quotaLoading || workflowLoading;
  const hasNoJobs = !isLoading && workflows.length === 0 && !isOverQuota;

  return (
    <PageShell className="pb-12">
      <PageHeader
        eyebrow="Recruiter workspace"
        title="Hiring command center"
        description="Keep live sessions, review bottlenecks, and shortlist momentum in one calm view."
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
          description="Create your first interview and this space will start surfacing pipeline health, live sessions, and candidate decisions."
          action={<CreateInterviewCard />}
        />
      ) : (
        <>
          <Section
            title="Attention first"
            description="The top signals that should shape today’s recruiting decisions."
          >
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
                    href={`/interviews/${workflow.interview.id}?call=${candidate.callId}`}
                    className="flex items-start justify-between gap-4 rounded-[20px] border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-4 transition-colors hover:border-[#c5ccb6] hover:bg-[#f3f7ea]"
                  >
                    <div className="min-w-0">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#203b14]" />
                        <p className="truncate text-sm font-semibold text-[#0a1d08]">
                          {candidate.displayName}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-sm text-[#53614d]">
                        {workflow.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#53614d]">
                        {candidate.summary}
                      </p>
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
                    href={`/interviews/${workflow.interview.id}?call=${candidate.callId}`}
                    className="flex items-center justify-between gap-4 rounded-[20px] border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-4 transition-colors hover:border-[#c5ccb6] hover:bg-[#f6f8ef]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0a1d08]">
                        {candidate.displayName}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#53614d]">
                        {workflow.title}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                          candidate.stage === "interrupted"
                            ? "critical"
                            : "warning",
                        )}`}
                      >
                        {candidate.stage === "interrupted"
                          ? "Interrupted"
                          : "Needs review"}
                      </span>
                      <p className="mt-2 text-xs text-[#6f7866]">
                        {candidate.score !== null
                          ? `Score ${candidate.score}`
                          : "Analysis pending"}
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

          <Section
            title="Job workflows"
            description={`${summary.totalJobs} active hiring surfaces derived from your existing interviews.`}
          >
            <DataGrid cols="3">
              {isOverQuota ? (
                <div className="flex min-h-[280px] flex-col items-start justify-between rounded-[28px] border border-dashed border-[#c5ccb6] bg-[#f4f5ec] p-6 text-[#0a1d08]">
                  <div className="space-y-3">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#ebe4db] text-[#4a3212]">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-xl font-semibold tracking-[-0.04em]">
                        Unlock more job workflows
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[#53614d]">
                        Upgrade to keep opening new interview links after your current response allowance.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
                    onClick={() => setIsModalOpen(true)}
                  >
                    Upgrade plan
                  </Button>
                </div>
              ) : null}

              {!isOverQuota ? <CreateInterviewCard /> : null}

              {workflows.map((workflow) => (
                <InterviewCard key={workflow.interview.id} workflow={workflow} />
              ))}
            </DataGrid>
          </Section>

          {workflows.length > 0 ? (
            <Section
              title="What to do next"
              description="Quick readouts to keep the hiring motion friendly and decisive."
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef4e1] text-[#203b14]">
                      <Play className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-base font-semibold text-[#0a1d08]">
                        Stay close to live interviews
                      </p>
                      <p className="mt-1 text-sm text-[#53614d]">
                        {summary.liveSessions > 0
                          ? `${summary.liveSessions} live session${summary.liveSessions === 1 ? "" : "s"} can be monitored from the matching job workspace.`
                          : "No candidates are currently interviewing, so focus can stay on reviews and next actions."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f7efe8] text-[#4a3212]">
                      <Search className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-base font-semibold text-[#0a1d08]">
                        Clear the review queue
                      </p>
                      <p className="mt-1 text-sm text-[#53614d]">
                        {summary.reviewQueue > 0
                          ? `${summary.reviewQueue} candidate${summary.reviewQueue === 1 ? "" : "s"} have finished and still need a decision.`
                          : "The decision queue is clear right now."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f6ebe7] text-[#6b3f31]">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-base font-semibold text-[#0a1d08]">
                        Recover interrupted sessions
                      </p>
                      <p className="mt-1 text-sm text-[#53614d]">
                        {summary.interruptedSessions > 0
                          ? `${summary.interruptedSessions} session${summary.interruptedSessions === 1 ? "" : "s"} ended early and may deserve a closer look.`
                          : "There are no interrupted sessions competing for attention."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          ) : null}
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
                You have reached the current response allowance for the free plan.
                Upgrade to continue collecting candidates and keep every workflow active.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[0.95fr_1.05fr]">
              <div className="flex items-center justify-center rounded-[24px] border border-[#e0e5d5] bg-[#f6f8ef] p-6">
                <Image
                  src="/premium-plan-icon.png"
                  alt="Premium plan"
                  width={240}
                  height={240}
                />
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

export default Interviews;
