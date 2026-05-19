"use client";

import React, { useMemo, useState } from "react";
import { MessageCircle, Mic2, Sparkles, Wand2 } from "lucide-react";

import { useInterviewers } from "@/contexts/interviewers.context";
import InterviewerCard from "@/components/dashboard/interviewer/InterviewerCard";
import NewInterviewerCard from "@/components/dashboard/interviewer/NewInterviewerCard";
import CreateInterviewerModal from "@/components/dashboard/interviewer/CreateInterviewerModal";
import { Button } from "@/components/ui/button";
import {
  PageShell,
  PageHeader,
  Section,
  DataGrid,
} from "@/components/ui/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { VOICE_OPTIONS } from "@/lib/constants";

const LOADER_CARD_KEYS = [
  "interviewer-loader-1",
  "interviewer-loader-2",
  "interviewer-loader-3",
  "interviewer-loader-4",
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

function Interviewers() {
  const { interviewers, interviewersLoading } = useInterviewers();
  const [createOpen, setCreateOpen] = useState(false);

  const voiceCount = useMemo(() => {
    return new Set(
      interviewers
        .map((interviewer) => interviewer.voice_id)
        .filter((voiceId): voiceId is string => Boolean(voiceId)),
    ).size;
  }, [interviewers]);

  const averageEmpathy = useMemo(() => {
    if (interviewers.length === 0) {
      return 0;
    }

    const total = interviewers.reduce(
      (sum, interviewer) => sum + interviewer.empathy,
      0,
    );

    return Math.round((total / interviewers.length) * 10) / 10;
  }, [interviewers]);

  const voicePalette = voiceCount === 0 ? VOICE_OPTIONS.length : voiceCount;

  return (
    <PageShell className="gap-10">
      <PageHeader
        eyebrow="Persona Library"
        title="Shape the voices behind every interview"
        description="Curate interviewer personas with distinct tone, pacing, and probing style so each role feels intentionally staffed before a candidate joins the session."
        className="border-none pb-0"
        actions={
          <Button
            className="rounded-full px-5"
            onClick={() => setCreateOpen(true)}
          >
            Compose persona
          </Button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
        <div className="relative overflow-hidden rounded-[32px] border border-[#dfe4d4] bg-[#f8fbf0] p-6 shadow-[0_0_0_1px_rgba(99,143,61,0.08)] md:p-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            aria-hidden="true"
          >
            <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,rgba(215,232,181,0.7),transparent_60%)]" />
            <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(197,204,182,0.35),transparent_68%)]" />
          </div>
          <div className="relative flex h-full flex-col justify-between gap-8">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#203b14]">
                <Sparkles className="h-3.5 w-3.5" />
                Editorial persona studio
              </div>
              <div className="space-y-3">
                <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-[#0a1d08] md:text-[2.6rem]">
                  Treat interviewers like cast members, not configuration rows.
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[#42513d] md:text-base">
                  Each persona should signal how they listen, where they probe,
                  and what kind of candidate conversation they create. Recruiters
                  can browse the collection, open the full composition, and add a
                  new interviewer without leaving this workspace.
                </p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  <Wand2 className="h-3.5 w-3.5 text-[#203b14]" />
                  Identity first
                </div>
                <p className="mt-3 text-sm leading-6 text-[#203b14]">
                  Name, portrait, and description establish the role each
                  persona plays in the library.
                </p>
              </div>
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  <Mic2 className="h-3.5 w-3.5 text-[#203b14]" />
                  Voice direction
                </div>
                <p className="mt-3 text-sm leading-6 text-[#203b14]">
                  Recruiters can match tone and delivery to the role without
                  reading raw IDs or hidden settings.
                </p>
              </div>
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  <MessageCircle className="h-3.5 w-3.5 text-[#203b14]" />
                  Conversation stance
                </div>
                <p className="mt-3 text-sm leading-6 text-[#203b14]">
                  Trait sliders stay visible as shorthand for warmth, depth,
                  cadence, and candidate comfort.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-[28px] border border-[#dfe4d4] bg-[#fbfdf6] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b7568]">
              Library pulse
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[20px] border border-[#e0e5d5] bg-[#f8fbf0] p-4">
                <p className="text-3xl font-semibold tracking-[-0.05em] text-[#0a1d08]">
                  {interviewers.length}
                </p>
                <p className="mt-2 text-sm text-[#42513d]">
                  Active {interviewers.length === 1 ? "persona" : "personas"} in
                  the studio
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[20px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                  <p className="text-2xl font-semibold tracking-[-0.05em] text-[#0a1d08]">
                    {voicePalette}
                  </p>
                  <p className="mt-2 text-sm text-[#42513d]">
                    Voice options represented in the collection
                  </p>
                </div>
                <div className="rounded-[20px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                  <p className="text-2xl font-semibold tracking-[-0.05em] text-[#0a1d08]">
                    {averageEmpathy || "0.0"}
                  </p>
                  <p className="mt-2 text-sm text-[#42513d]">
                    Average empathy setting across current personas
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#dfe4d4] bg-[#203b14] p-5 text-[#fbfdf6]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#d7e8b5]">
              Composition prompt
            </p>
            <p className="mt-3 text-lg font-medium leading-7 tracking-[-0.03em]">
              Start with the interviewer’s role in the room, then tune the
              voice and prompt until the tone feels deliberate.
            </p>
            <Button
              variant="outline"
              className="mt-5 rounded-full border-[#d7e8b5] bg-transparent px-5 text-[#fbfdf6] hover:bg-[#2b4e1d] hover:text-[#fbfdf6]"
              onClick={() => setCreateOpen(true)}
            >
              Open composition flow
            </Button>
          </div>
        </aside>
      </section>

      <Section
        title="Persona collection"
        description={
          interviewers.length > 0
            ? "Browse the active library, compare voice and conversation style, and open any persona to inspect or manage it."
            : "Build the first interviewer persona to give your jobs a clear voice before candidates arrive."
        }
        actions={
          interviewers.length > 0 ? (
            <div className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-3 py-1 text-sm text-[#42513d]">
              {interviewers.length}{" "}
              {interviewers.length === 1 ? "persona" : "personas"}
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
                    Give the platform a clear interviewing voice: choose a face,
                    set the pace, and write the conversational stance that should
                    guide every screening session.
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
                  Compose a persona that feels intentional for the role instead
                  of cloning a generic interviewer.
                </p>
                <Button
                  className="rounded-full px-5"
                  onClick={() => setCreateOpen(true)}
                >
                  Compose the first persona
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  Browse by feeling
                </p>
                <p className="mt-2 text-sm leading-6 text-[#203b14]">
                  Look for the right balance of empathy, rapport, and
                  exploration before matching a persona to a role.
                </p>
              </div>
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  Open for full composition
                </p>
                <p className="mt-2 text-sm leading-6 text-[#203b14]">
                  Every card expands into the full prompt, audio sample, and
                  trait profile without changing the underlying CRUD contract.
                </p>
              </div>
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  Add deliberately
                </p>
                <p className="mt-2 text-sm leading-6 text-[#203b14]">
                  The create flow is tuned for persona composition so recruiters
                  can think in conversation style, not raw configuration.
                </p>
              </div>
            </div>

            <DataGrid cols="4" className="items-stretch">
              <NewInterviewerCard onClick={() => setCreateOpen(true)} />
              {interviewers.map((interviewer) => (
                <InterviewerCard
                  key={String(interviewer.id)}
                  interviewer={interviewer}
                />
              ))}
            </DataGrid>
          </div>
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
