"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Mic2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Modal from "@/components/dashboard/Modal";
import { Interviewer } from "@/types/interviewer";
import InterviewerDetailsModal from "@/components/dashboard/interviewer/interviewerDetailsModal";
import EditInterviewerModal from "@/components/dashboard/interviewer/EditInterviewerModal";
import DeleteInterviewerDialog from "@/components/dashboard/interviewer/DeleteInterviewerDialog";
import { useInterviewers } from "@/contexts/interviewers.context";
import { VOICE_OPTIONS } from "@/lib/constants";

interface Props {
  interviewer: Interviewer;
}

const VOICE_LABELS = Object.fromEntries(
  VOICE_OPTIONS.map((voice) => [voice.id, voice.label]),
);

const TRAIT_DEFINITIONS = [
  { key: "empathy", label: "Empathy" },
  { key: "exploration", label: "Exploration" },
  { key: "rapport", label: "Rapport" },
  { key: "speed", label: "Pace" },
] as const;

function describeTrait(value: number | undefined, mode: "warmth" | "depth" | "flow" | "cadence") {
  const safeValue = value ?? 5;

  switch (mode) {
    case "warmth":
      if (safeValue >= 8) {
        return "high warmth";
      }

      if (safeValue >= 6) {
        return "measured warmth";
      }

      return "direct warmth";
    case "depth":
      if (safeValue >= 8) {
        return "deep probing";
      }

      if (safeValue >= 6) {
        return "balanced probing";
      }

      return "light probing";
    case "flow":
      if (safeValue >= 8) {
        return "easy rapport";
      }

      if (safeValue >= 6) {
        return "steady rapport";
      }

      return "formal rapport";
    case "cadence":
      if (safeValue >= 8) {
        return "fast cadence";
      }

      if (safeValue >= 6) {
        return "steady cadence";
      }

      return "deliberate cadence";
  }
}

function InterviewerCard({ interviewer }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { deleteInterviewer } = useInterviewers();

  const voiceLabel = interviewer.voice_id
    ? VOICE_LABELS[interviewer.voice_id] ?? interviewer.voice_id
    : "Voice not set";

  const personaSummary = useMemo(() => {
    return [
      describeTrait(interviewer.empathy, "warmth"),
      describeTrait(interviewer.exploration, "depth"),
      describeTrait(interviewer.rapport, "flow"),
    ].join(" · ");
  }, [interviewer.empathy, interviewer.exploration, interviewer.rapport]);

  const handleDelete = async () => {
    try {
      await deleteInterviewer(Number(interviewer.id));
      toast.success(`${interviewer.name} deleted`);
      setDeleteOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to delete: ${msg}`);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <Card
        className="group relative flex h-full min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-[28px] border border-[#dfe4d4] bg-[#fbfdf6] p-0 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-[#ced8bf] hover:bg-[#f8fbf0]"
        role="button"
        tabIndex={0}
        onClick={() => setDetailsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setDetailsOpen(true);
          }
        }}
      >
        <CardContent className="flex h-full flex-col p-0">
          <div className="relative overflow-hidden border-b border-[#e0e5d5] bg-[#eef2e4] px-5 pb-5 pt-4">
            <div
              className="pointer-events-none absolute inset-0 opacity-80"
              aria-hidden="true"
            >
              <div className="absolute -left-10 top-2 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(215,232,181,0.6),transparent_68%)]" />
              <div className="absolute right-0 top-0 h-36 w-36 bg-[radial-gradient(circle,rgba(197,204,182,0.42),transparent_62%)]" />
            </div>

            <div className="relative flex items-start justify-between gap-3">
              <div className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#203b14]">
                Persona
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-[#fbfdf6]/90 px-2.5 py-1 text-[11px] text-[#42513d]">
                <Mic2 className="h-3.5 w-3.5 text-[#203b14]" />
                Voice
              </div>
            </div>

            <div className="relative mt-8 flex items-end gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[22px] border border-[#d7e8b5] bg-[#fbfdf6] shadow-[0_0_0_1px_rgba(99,143,61,0.08)]">
                <Image
                  src={interviewer.image}
                  alt={`${interviewer.name} portrait`}
                  sizes="96px"
                  className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                  fill
                />
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                  {voiceLabel}
                </p>
                <CardTitle className="mt-2 truncate text-xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
                  {interviewer.name}
                </CardTitle>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#31412c]">
                  {personaSummary}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-5 p-5">
            <p className="line-clamp-4 min-h-[96px] text-sm leading-6 text-[#42513d]">
              {interviewer.description}
            </p>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[#e0e5d5] bg-[#f8fbf0] px-3 py-1 text-xs text-[#203b14]">
                {describeTrait(interviewer.speed, "cadence")}
              </span>
              <span className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-3 py-1 text-xs text-[#203b14]">
                Prompt ready
              </span>
              {interviewer.audio ? (
                <span className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-3 py-1 text-xs text-[#203b14]">
                  Voice sample
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TRAIT_DEFINITIONS.map((trait) => {
                const value = interviewer[trait.key];

                return (
                  <div
                    key={trait.key}
                    className="rounded-[18px] border border-[#e0e5d5] bg-[#fbfdf6] p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.14em] text-[#6b7568]">
                        {trait.label}
                      </span>
                      <span className="text-sm font-medium text-[#0a1d08]">
                        {value}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-[#edf1e3]">
                      <div
                        className="h-full rounded-full bg-[#203b14]"
                        style={{ width: `${Math.max(10, (value / 10) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>

        <button
          type="button"
          aria-label={`Edit ${interviewer.name}`}
          className="absolute right-14 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#fbfdf6]/95 text-[#42513d] opacity-0 backdrop-blur-sm transition-all hover:border-[#203b14] hover:bg-[#203b14] hover:text-[#fbfdf6] group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setEditOpen(true);
          }}
        >
          <Pencil size={16} />
        </button>
        <button
          type="button"
          aria-label={`Delete ${interviewer.name}`}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#fbfdf6]/95 text-[#42513d] opacity-0 backdrop-blur-sm transition-all hover:border-[#4a3212] hover:bg-[#4a3212] hover:text-[#fbfdf6] group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteOpen(true);
          }}
        >
          <Trash2 size={16} />
        </button>
      </Card>

      <Modal
        open={detailsOpen}
        size="xl"
        closeOnOutsideClick={true}
        title={interviewer.name}
        onClose={() => setDetailsOpen(false)}
      >
        <InterviewerDetailsModal interviewer={interviewer} />
        <div className="mt-2 flex justify-end border-t border-[#e0e5d5] pt-4">
          <Button
            type="button"
            className="rounded-full px-5"
            onClick={() => {
              setDetailsOpen(false);
              setEditOpen(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit persona
          </Button>
        </div>
      </Modal>

      <EditInterviewerModal
        open={editOpen}
        interviewer={interviewer}
        onClose={() => setEditOpen(false)}
      />

      <DeleteInterviewerDialog
        open={deleteOpen}
        interviewerName={interviewer.name}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}

export default InterviewerCard;
