"use client";

import React, { useState } from "react";

import { useInterviewers } from "@/contexts/interviewers.context";
import InterviewerCard from "@/components/dashboard/interviewer/InterviewerCard";
import NewInterviewerCard from "@/components/dashboard/interviewer/NewInterviewerCard";
import CreateInterviewerModal from "@/components/dashboard/interviewer/CreateInterviewerModal";
import {
  PageShell,
  PageHeader,
  Section,
  DataGrid,
} from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

const LOADER_CARD_KEYS = [
  "interviewer-loader-1",
  "interviewer-loader-2",
  "interviewer-loader-3",
  "interviewer-loader-4",
];

function InterviewersLoader() {
  return (
    <DataGrid cols="4">
      {LOADER_CARD_KEYS.map((key) => (
        <Skeleton key={key} className="h-48 w-full rounded-xl" />
      ))}
    </DataGrid>
  );
}

function Interviewers() {
  const { interviewers, interviewersLoading } = useInterviewers();
  const [createOpen, setCreateOpen] = useState(false);

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
        ) : (
          <DataGrid cols="4">
            {interviewers.map((interviewer) => (
              <InterviewerCard
                key={String(interviewer.id)}
                interviewer={interviewer}
              />
            ))}
            <NewInterviewerCard onClick={() => setCreateOpen(true)} />
          </DataGrid>
        )}
      </Section>

      <CreateInterviewerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </PageShell>
  );
}

export default Interviewers;
