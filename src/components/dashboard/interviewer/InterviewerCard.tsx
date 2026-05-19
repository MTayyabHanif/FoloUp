import { useState } from "react";
import Image from "next/image";

import { Card, CardContent, CardTitle } from "@/components/ui/card";
import Modal from "@/components/dashboard/Modal";
import { Interviewer } from "@/types/interviewer";
import InterviewerDetailsModal from "@/components/dashboard/interviewer/interviewerDetailsModal";

interface Props {
  interviewer: Interviewer;
}

const InterviewerCard = ({ interviewer }: Props) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card
        className="group flex h-48 cursor-pointer flex-col overflow-hidden rounded-xl bg-card p-0 transition-all hover:-translate-y-0.5 hover:shadow-[var(--ds-shadow-overflow)]"
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
        <CardContent className="flex h-full flex-col p-0">
          <div className="relative h-32 w-full overflow-hidden bg-secondary">
            <Image
              src={interviewer.image}
              alt={`${interviewer.name} portrait`}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex flex-1 items-center justify-center px-3 py-2">
            <CardTitle className="truncate text-sm font-semibold">
              {interviewer.name}
            </CardTitle>
          </div>
        </CardContent>
      </Card>
      <Modal
        open={open}
        size="xl"
        closeOnOutsideClick={true}
        onClose={() => {
          setOpen(false);
        }}
      >
        <InterviewerDetailsModal interviewer={interviewer} />
      </Modal>
    </>
  );
};

export default InterviewerCard;
