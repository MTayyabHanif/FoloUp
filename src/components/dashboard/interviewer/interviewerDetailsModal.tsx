import Image from "next/image";
import ReactAudioPlayer from "react-audio-player";

import { CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Interviewer } from "@/types/interviewer";

interface Props {
  interviewer: Interviewer | undefined;
}

/**
 * Per-trait control row. Slider + numeric value to the right.
 */
function TraitControl({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  const normalized = (value ?? 10) / 10;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm font-medium text-foreground">
        {label}
      </span>
      <div className="flex-1">
        <Slider value={[normalized]} max={1} step={0.1} />
      </div>
      <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
        {normalized.toFixed(1)}
      </span>
    </div>
  );
}

function InterviewerDetailsModal({ interviewer }: Props) {
  return (
    <div className="flex w-full flex-col gap-6">
      {/* Header */}
      <header className="text-center">
        <CardTitle className="text-2xl font-semibold">
          {interviewer?.name}
        </CardTitle>
      </header>

      {/* Portrait + description side-by-side at md+, stacked on mobile */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="h-40 w-36 shrink-0 overflow-hidden rounded-xl border-2 border-border bg-secondary">
          <Image
            src={interviewer?.image || ""}
            alt={`${interviewer?.name ?? "Interviewer"} portrait`}
            width={180}
            height={200}
            className="h-full w-full object-cover object-center"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {interviewer?.description}
          </p>
          {interviewer?.audio && (
            <ReactAudioPlayer
              src={`/audio/${interviewer.audio}`}
              controls
              className="w-full"
            />
          )}
        </div>
      </div>

      {/* Trait sliders */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Interviewer settings
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3">
          <TraitControl label="Empathy" value={interviewer?.empathy} />
          <TraitControl label="Exploration" value={interviewer?.exploration} />
          <TraitControl label="Rapport" value={interviewer?.rapport} />
          <TraitControl label="Speed" value={interviewer?.speed} />
        </div>
      </section>
    </div>
  );
}

export default InterviewerDetailsModal;
