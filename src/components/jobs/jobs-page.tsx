"use client";

import { PauseCircle, PlayCircle, Sparkles } from "lucide-react";

import { CreateInterviewButton } from "@/components/dashboard/interview/createInterviewButton";
import CreateInterviewCard from "@/components/dashboard/interview/createInterviewCard";
import InterviewCard from "@/components/dashboard/interview/interviewCard";
import { useJobWorkflows } from "@/components/jobs/use-job-workflows";
import { EmptyState } from "@/components/ui/empty-state";
import { DataGrid, PageHeader, PageShell, Section } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

function JobsLoader() {
  const loaderKeys = [
    "job-loader-1",
    "job-loader-2",
    "job-loader-3",
    "job-loader-4",
    "job-loader-5",
    "job-loader-6",
  ] as const;

  return (
    <DataGrid cols="3">
      {loaderKeys.map((key) => (
        <Skeleton key={key} className="h-72 rounded-[28px]" />
      ))}
    </DataGrid>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-5 text-[#0a1d08]">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[#53614d]">{detail}</p>
    </div>
  );
}

export function JobsPage() {
  const { isLoading, isOverQuota, summary, workflows } = useJobWorkflows();

  return (
    <PageShell className="pb-12">
      <PageHeader
        eyebrow="Jobs"
        title="Manage every hiring workflow"
        description="Browse active and paused jobs, open a workspace, and create the next role from one operational surface."
        actions={<CreateInterviewButton className="rounded-full px-5" />}
      />

      <Section
        title="Job workflows"
        description={`${summary.totalJobs} hiring workflow${summary.totalJobs === 1 ? "" : "s"} currently mapped across your organization.`}
      >
        {isLoading ? (
          <JobsLoader />
        ) : workflows.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="No jobs yet"
            description="Create the first job workflow to start collecting candidate sessions and recruiter signal."
            action={<CreateInterviewButton className="rounded-full px-5" />}
          />
        ) : (
          <DataGrid cols="3">
            {workflows.map((workflow) => (
              <InterviewCard key={workflow.interview.id} workflow={workflow} />
            ))}
            {!isOverQuota ? <CreateInterviewCard /> : null}
          </DataGrid>
        )}
      </Section>
    </PageShell>
  );
}
