"use client";

import { MessageCircle, Mic2, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";

import CreateInterviewerModal from "@/components/dashboard/interviewer/CreateInterviewerModal";
import InterviewerCard from "@/components/dashboard/interviewer/InterviewerCard";
import NewInterviewerCard from "@/components/dashboard/interviewer/NewInterviewerCard";
import { Button } from "@/components/ui/button";
import { DataGrid, PageHeader, PageShell, Section } from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useInterviewers } from "@/contexts/interviewers.context";

const LOADER_CARD_KEYS = [
  "persona-loader-1",
  "persona-loader-2",
  "persona-loader-3",
  "persona-loader-4",
];

function InterviewersLoader() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {["a", "b", "c"].map((key) => (
          <Skeleton key={key} className="h-28 rounded-[28px]" />
        ))}
      </div>
      <DataGrid cols="4">
        {LOADER_CARD_KEYS.map((key) => (
          <Skeleton key={key} className="h-[360px] w-full rounded-[28px]" />
        ))}
      </DataGrid>
    </div>
  );
}

export function PersonasPage() {
  const { interviewers, interviewersLoading } = useInterviewers();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PageShell className="gap-10">
      <PageHeader
        eyebrow="Personas"
        title="Shape the voices behind every interview"
        description="Curate interviewer personas with distinct tone, pacing, and probing style so each role feels intentionally staffed before a candidate joins the session."
        className="border-none pb-0"
        actions={
          <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
            Compose persona
          </Button>
        }
      />

      <Section
        title="Persona library"
        description={
          interviewers.length > 0
            ? "Browse the active library, compare voice and conversation style, and open any persona to inspect or manage it."
            : "Build the first interviewer persona to give your jobs a clear voice before candidates arrive."
        }
        actions={
          interviewers.length > 0 ? (
            <div className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-3 py-1 text-sm text-[#42513d]">
              {interviewers.length} {interviewers.length === 1 ? "persona" : "personas"}
            </div>
          ) : null
        }
      >
        {interviewersLoading ? (
          <InterviewersLoader />
        ) : (
          <div className="space-y-4">
            <DataGrid cols="3" className="items-stretch">
              {interviewers.map((interviewer) => (
                <InterviewerCard key={String(interviewer.id)} interviewer={interviewer} />
              ))}
              <NewInterviewerCard onClick={() => setCreateOpen(true)} />
            </DataGrid>
          </div>
        )}
      </Section>

      <CreateInterviewerModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageShell>
  );
}
