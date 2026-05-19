"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  interviewerName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function DeleteInterviewerDialog({
  open,
  interviewerName,
  onConfirm,
  onCancel,
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isDeleting) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent className="max-w-xl rounded-[28px] border-[#dfe4d4] bg-[#fbfdf6] p-0 shadow-[0_16px_40px_rgba(10,29,8,0.08)]">
        <div className="border-b border-[#e0e5d5] bg-[#f8fbf0] px-6 py-5">
          <div className="inline-flex rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#203b14]">
            Persona management
          </div>
        </div>
        <div className="px-6 py-6">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="text-2xl tracking-[-0.04em] text-[#0a1d08]">
              Remove {interviewerName} from the library?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-7 text-[#42513d]">
              This hides the persona from the recruiter-facing library. Interviews
              already configured to use {interviewerName} will continue to work,
              so in-flight and past sessions are unaffected. The dashboard does
              not offer an undo after removal.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="mt-5 rounded-[22px] border border-[#e0e5d5] bg-[#f8fbf0] p-4 text-sm leading-6 text-[#5e6958]">
            Use this when the persona should no longer be assigned to future
            interviews, not when you simply want to inspect or compare it.
          </div>

          <AlertDialogFooter className="mt-6 flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:space-x-0">
            <AlertDialogCancel
              disabled={isDeleting}
              className="mt-0 rounded-full border-[#dfe4d4] bg-[#fbfdf6] text-[#203b14] hover:bg-[#f5f8ed]"
            >
              Keep persona
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="rounded-full bg-[#4a3212] text-[#fbfdf6] hover:bg-[#3d290f]"
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove persona"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteInterviewerDialog;
