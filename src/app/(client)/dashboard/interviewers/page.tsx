"use client";

import React from "react";
import { Users } from "lucide-react";

import { useInterviewers } from "@/contexts/interviewers.context";
import InterviewerCard from "@/components/dashboard/interviewer/InterviewerCard";
import CreateInterviewerButton from "@/components/dashboard/interviewer/createInterviewerButton";
import {
  PageShell,
  PageHeader,
  Section,
  DataGrid,
} from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

function InterviewersLoader() {
  return (
    <DataGrid cols="4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 w-full rounded-xl" />
      ))}
    </DataGrid>
  );
}

function Interviewers() {
  const { interviewers, interviewersLoading } = useInterviewers();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Interviewers"
        description="AI interviewer personas. Click a card to inspect the voice, style, and parameters."
      />

      <Section
        title="Roster"
        description={
          interviewers.length > 0
            ? `${interviewers.length} ${interviewers.length === 1 ? "interviewer" : "interviewers"}`
            : undefined
        }
      >
        {interviewersLoading ? (
          <InterviewersLoader />
        ) : interviewers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No interviewers yet"
            description="Bootstrap the default Lisa and Bob interviewers to start using Robust Devs Hiring."
            action={<CreateInterviewerButton />}
          />
        ) : (
          <DataGrid cols="4">
            {interviewers.map((interviewer) => (
              <InterviewerCard
                key={interviewer.id}
                interviewer={interviewer}
              />
            ))}
          </DataGrid>
        )}
      </Section>
    </PageShell>
  );
}

export default Interviewers;
