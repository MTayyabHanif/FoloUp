"use client";

import { useState } from "react";

import Modal from "@/components/dashboard/Modal";
import CreateInterviewModal from "@/components/dashboard/interview/createInterviewModal";
import { Button } from "@/components/ui/button";

interface CreateInterviewButtonProps {
  className?: string;
  label?: string;
}

export function CreateInterviewButton({
  className,
  label = "Create job",
}: CreateInterviewButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className={className} onClick={() => setOpen(true)}>
        {label}
      </Button>

      <Modal open={open} size="2xl" closeOnOutsideClick={false} onClose={() => setOpen(false)}>
        <CreateInterviewModal open={open} setOpen={setOpen} />
      </Modal>
    </>
  );
}
