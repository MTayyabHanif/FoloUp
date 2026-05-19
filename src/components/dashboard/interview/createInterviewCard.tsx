"use client";

import React, { useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import CreateInterviewModal from "@/components/dashboard/interview/createInterviewModal";
import Modal from "@/components/dashboard/Modal";

function CreateInterviewCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        className="group min-h-[280px] cursor-pointer rounded-[28px] border border-dashed border-[#c5ccb6] bg-[#f6f8ef] text-[#0a1d08] shadow-none transition-all hover:-translate-y-0.5 hover:border-[#203b14] hover:bg-[#eef4e1]"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <CardContent className="flex h-full flex-col justify-between gap-8 p-6 pt-6">
          <div className="flex items-start justify-between gap-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#fbfdf6] text-[#203b14] transition-transform group-hover:scale-110">
              <Plus className="h-6 w-6" strokeWidth={2} />
            </span>
            <span className="inline-flex rounded-full border border-[#d8ddd0] bg-[#fbfdf6] px-3 py-1 text-xs font-semibold text-[#53614d]">
              New workflow
            </span>
          </div>

          <div className="space-y-3">
            <h3 className="text-[30px] font-semibold leading-[1.02] tracking-[-0.05em]">
              Create a new job interview
            </h3>
            <p className="text-sm leading-6 text-[#53614d]">
              Start with a role brief, generate questions, and launch a candidate-ready workflow from the dashboard.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#203b14]">
            <Sparkles className="h-4 w-4" />
            Guided setup inside the current workspace
          </div>
        </CardContent>
      </Card>

      <Modal
        open={open}
        size="2xl"
        closeOnOutsideClick={false}
        onClose={() => {
          setOpen(false);
        }}
      >
        <CreateInterviewModal open={open} setOpen={setOpen} />
      </Modal>
    </>
  );
}

export default CreateInterviewCard;
