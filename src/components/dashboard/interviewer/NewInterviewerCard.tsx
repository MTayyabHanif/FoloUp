"use client";

import { Plus } from "lucide-react";

import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface Props {
  onClick: () => void;
}

function NewInterviewerCard({ onClick }: Props) {
  return (
    <Card
      className="group flex h-48 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-card p-0 transition-all hover:-translate-y-0.5 hover:border-brand-bold hover:shadow-[var(--ds-shadow-overflow)]"
      role="button"
      tabIndex={0}
      aria-label="Create a new interviewer"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="flex h-full w-full flex-col items-center justify-center gap-2 p-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors group-hover:bg-brand-bold/10 group-hover:text-brand-bold">
          <Plus size={24} />
        </div>
        <CardTitle className="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
          New Interviewer
        </CardTitle>
      </CardContent>
    </Card>
  );
}

export default NewInterviewerCard;
