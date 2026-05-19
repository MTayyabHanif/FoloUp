"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import CreateInterviewModal from "@/components/dashboard/interview/createInterviewModal";
import Modal from "@/components/dashboard/Modal";

function CreateInterviewCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        className="group flex h-60 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed bg-card transition-all hover:border-brand-bold hover:bg-brand-subtlest"
        onClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <CardContent className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-subtlest text-brand-bold transition-transform group-hover:scale-110">
            <Plus className="h-7 w-7" strokeWidth={2} />
          </div>
          <CardTitle className="text-sm font-semibold">
            Create an interview
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Auto-generate questions from a job description.
          </p>
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
