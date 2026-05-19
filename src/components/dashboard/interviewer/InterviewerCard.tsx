"use client";

import { useState } from "react";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import Modal from "@/components/dashboard/Modal";
import { Interviewer } from "@/types/interviewer";
import InterviewerDetailsModal from "@/components/dashboard/interviewer/interviewerDetailsModal";
import DeleteInterviewerDialog from "@/components/dashboard/interviewer/DeleteInterviewerDialog";
import { useInterviewers } from "@/contexts/interviewers.context";

interface Props {
  interviewer: Interviewer;
}

function InterviewerCard({ interviewer }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { deleteInterviewer } = useInterviewers();

  const handleDelete = async () => {
    try {
      // `id` on the row is a number per database.types.ts even though the
      // Interviewer TS type carries it as bigint. Coerce defensively for
      // both the call signature and the JSON encode path.
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
        className="group relative flex h-48 cursor-pointer flex-col overflow-hidden rounded-xl bg-card p-0 transition-all hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-overflow)]"
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
          <div className="relative h-32 w-full overflow-hidden bg-secondary">
            <Image
              src={interviewer.image}
              alt={`${interviewer.name} portrait`}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
              fill
            />
          </div>
          <div className="flex flex-1 items-center justify-center px-3 py-2">
            <CardTitle className="truncate text-sm font-semibold">
              {interviewer.name}
            </CardTitle>
          </div>
        </CardContent>
        <button
          type="button"
          aria-label={`Delete ${interviewer.name}`}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-foreground opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100 [@media(hover:none)]:opacity-100"
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
      </Modal>
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
