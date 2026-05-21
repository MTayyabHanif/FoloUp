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
        ) : interviewers.length === 0 ? (
          <div className="overflow-hidden rounded-[32px] border border-dashed border-[#c5ccb6] bg-[#f8fbf0] p-6 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.7fr)] lg:items-end">
              <div className="space-y-4">
                <div className="inline-flex w-fit items-center rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#203b14]">
                  No personas yet
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
                    Create the first interviewer in your library
                  </h3>
                  <p className="max-w-2xl text-sm leading-7 text-[#42513d]">
                    Give the platform a clear interviewing voice: choose a face, set the pace, and
                    write the conversational stance that should guide every screening session.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-[#203b14]">
                  <span className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1">
                    Identity
                  </span>
                  <span className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1">
                    Voice
                  </span>
                  <span className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1">
                    Prompt direction
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
                <p className="text-sm leading-7 text-[#42513d]">
                  Compose a persona that feels intentional for the role instead of cloning a generic
                  interviewer.
                </p>
                <Button className="rounded-full px-5" onClick={() => setCreateOpen(true)}>
                  Compose the first persona
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef4e1] text-[#203b14]">
                    <Mic2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-[#0a1d08]">Voice range</p>
                    <p className="mt-1 text-sm text-[#53614d]">
                      Distinct vocal styles available across the current persona set.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f7efe8] text-[#4a3212]">
                    <MessageCircle className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-[#0a1d08]">Conversation styles</p>
                    <p className="mt-1 text-sm text-[#53614d]">
                      Keep probing approaches and rapport styles intentional instead of generic.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f6ebe7] text-[#6b3f31]">
                    <Wand2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-[#0a1d08]">Ready to assign</p>
                    <p className="mt-1 text-sm text-[#53614d]">
                      Personas can be attached to any job workflow as soon as they are composed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

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
