"use client";

import { Plus, Sparkles, Wand2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface Props {
  onClick: () => void;
}

function NewInterviewerCard({ onClick }: Props) {
  return (
    <Card
      className="group flex h-full min-h-[360px] cursor-pointer flex-col overflow-hidden rounded-[28px] border border-dashed border-[#c5ccb6] bg-[#f8fbf0] p-0 shadow-none transition-all duration-300 hover:-translate-y-1 hover:border-[#203b14] hover:bg-[#f5f9ea]"
      role="button"
      tabIndex={0}
      aria-label="Create a new interviewer persona"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="flex h-full w-full flex-col justify-between gap-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#203b14]">
            New persona
          </div>
          <div className="rounded-full bg-[#fbfdf6] p-3 text-[#203b14] transition-colors group-hover:bg-[#203b14] group-hover:text-[#fbfdf6]">
            <Plus size={18} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
              Compose a new interviewer
            </h3>
            <p className="text-sm leading-6 text-[#42513d]">
              Define the face, voice, and interviewing stance you want
              candidates to meet in the room.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center gap-2 rounded-[18px] border border-[#e0e5d5] bg-[#fbfdf6] px-3 py-2 text-sm text-[#203b14]">
              <Sparkles className="h-4 w-4" />
              Identity and presence
            </div>
            <div className="flex items-center gap-2 rounded-[18px] border border-[#e0e5d5] bg-[#fbfdf6] px-3 py-2 text-sm text-[#203b14]">
              <Wand2 className="h-4 w-4" />
              Prompt and conversation style
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#d7e8b5] bg-[#fbfdf6] px-4 py-3 text-sm text-[#203b14]">
          Open the studio
        </div>
      </CardContent>
    </Card>
  );
}

export default NewInterviewerCard;
