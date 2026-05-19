"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Loader2, MessageSquare, Mic2, Sparkles } from "lucide-react";

import Modal from "@/components/dashboard/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInterviewers } from "@/contexts/interviewers.context";
import { PROMPT_FOOTER_TEMPLATE, VOICE_OPTIONS } from "@/lib/constants";
import { avatars } from "@/components/dashboard/interviewer/avatars";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  description: string;
  image: string;
  voice_id: string;
  promptBody: string;
  empathy: number;
  rapport: number;
  exploration: number;
  speed: number;
}

const INITIAL_STATE: FormState = {
  name: "",
  description: "",
  image: "",
  voice_id: VOICE_OPTIONS[0]?.id ?? "",
  promptBody: "",
  empathy: 5,
  rapport: 5,
  exploration: 5,
  speed: 5,
};

const TRAIT_COPY = {
  empathy: {
    label: "Empathy",
    low: "Keeps the exchange crisp and direct.",
    mid: "Balances warmth with professional distance.",
    high: "Creates immediate safety and reassurance.",
  },
  rapport: {
    label: "Rapport",
    low: "Formal and interview-room focused.",
    mid: "Friendly without losing structure.",
    high: "Builds easy conversational chemistry.",
  },
  exploration: {
    label: "Exploration",
    low: "Stays close to the planned questions.",
    mid: "Adds selective follow-up depth.",
    high: "Probes deeply for signal and examples.",
  },
  speed: {
    label: "Pace",
    low: "Moves slowly and gives thinking space.",
    mid: "Keeps a calm, steady rhythm.",
    high: "Pushes the conversation forward quickly.",
  },
} as const;

function traitDescription(
  value: number,
  key: keyof typeof TRAIT_COPY,
): string {
  if (value >= 8) {
    return TRAIT_COPY[key].high;
  }

  if (value >= 5) {
    return TRAIT_COPY[key].mid;
  }

  return TRAIT_COPY[key].low;
}

function Fieldset({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5 md:p-6">
      <div className="mb-5 space-y-2">
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-[#0a1d08]">
          {title}
        </h3>
        <p className="text-sm leading-6 text-[#42513d]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TraitSlider({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-[#e0e5d5] bg-[#f8fbf0] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0a1d08]">{label}</p>
          <p className="text-xs leading-5 text-[#5e6958]">{description}</p>
        </div>
        <div className="rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-sm text-[#203b14]">
          {value}
        </div>
      </div>
      <Slider
        className="mt-4"
        value={[value]}
        min={1}
        max={10}
        step={1}
        disabled={disabled}
        onValueChange={(arr) => onChange(arr[0] ?? value)}
      />
    </div>
  );
}

function CreateInterviewerModal({ open, onClose }: Props) {
  const { fetchInterviewers } = useInterviewers();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const voiceLabel =
    VOICE_OPTIONS.find((voice) => voice.id === form.voice_id)?.label ??
    "Choose a voice";

  const personaMood = useMemo(() => {
    return [
      traitDescription(form.empathy, "empathy"),
      traitDescription(form.exploration, "exploration"),
    ];
  }, [form.empathy, form.exploration]);

  const reset = () => {
    setForm(INITIAL_STATE);
    setErrorMessage(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    reset();
    onClose();
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    const fullPrompt = `${form.promptBody.trim()}\n\n${PROMPT_FOOTER_TEMPLATE}`;

    try {
      const res = await fetch("/api/interviewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          image: form.image,
          voice_id: form.voice_id,
          prompt: fullPrompt,
          empathy: form.empathy,
          rapport: form.rapport,
          exploration: form.exploration,
          speed: form.speed,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail =
          typeof body?.details === "string" &&
          process.env.NODE_ENV !== "production"
            ? ` (Detail: ${body.details})`
            : "";

        if (res.status === 422) {
          setErrorMessage(body?.error ?? "Validation failed");
        } else {
          setErrorMessage(
            `Failed to create interviewer — please try again.${detail}`,
          );
        }

        return;
      }

      await fetchInterviewers();
      reset();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Failed to create interviewer — please try again. (${msg})`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitDisabled =
    isSubmitting ||
    !form.name.trim() ||
    !form.description.trim() ||
    !form.image ||
    !form.voice_id ||
    !form.promptBody.trim();

  return (
    <Modal
      open={open}
      size="2xl"
      title="Compose interviewer persona"
      closeOnOutsideClick={!isSubmitting}
      onClose={handleClose}
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <div className="overflow-hidden rounded-[32px] border border-[#dfe4d4] bg-[#f8fbf0]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_320px]">
            <div className="p-6 md:p-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d7e8b5] bg-[#fbfdf6] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#203b14]">
                <Sparkles className="h-3.5 w-3.5" />
                Persona composition
              </div>
              <div className="mt-4 space-y-3">
                <h2 className="text-3xl font-semibold leading-tight tracking-[-0.05em] text-[#0a1d08]">
                  Compose a voice candidates will actually meet
                </h2>
                <p className="max-w-2xl text-sm leading-7 text-[#42513d]">
                  Build the identity, choose the delivery, and write the
                  interviewing philosophy in one guided flow. The underlying CRUD
                  contract stays the same; the framing becomes much more
                  deliberate.
                </p>
              </div>
            </div>

            <aside className="border-t border-[#e0e5d5] bg-[#fbfdf6] p-6 xl:border-l xl:border-t-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#6b7568]">
                Live preview
              </p>
              <div className="mt-4 rounded-[28px] border border-[#e0e5d5] bg-[#f8fbf0] p-4">
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[22px] border border-[#d7e8b5] bg-[#fbfdf6]">
                    {form.image ? (
                      <Image
                        src={form.image}
                        alt={form.name ? `${form.name} avatar` : "Selected avatar"}
                        sizes="80px"
                        className="object-cover object-center"
                        fill
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[#6b7568]">
                        Pick one
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#6b7568]">
                      {voiceLabel}
                    </p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
                      {form.name.trim() || "Unnamed persona"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[#42513d]">
                      {form.description.trim() ||
                        "A short editorial description will help recruiters understand this interviewer at a glance."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  {(
                    Object.keys(TRAIT_COPY) as Array<keyof typeof TRAIT_COPY>
                  ).map((key) => (
                    <div
                      key={key}
                      className="rounded-[18px] border border-[#e0e5d5] bg-[#fbfdf6] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs uppercase tracking-[0.14em] text-[#6b7568]">
                          {TRAIT_COPY[key].label}
                        </span>
                        <span className="text-sm font-medium text-[#0a1d08]">
                          {form[key]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-[20px] border border-[#d7e8b5] bg-[#fbfdf6] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#6b7568]">
                    Current feel
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[#203b14]">
                    {personaMood[0]} {personaMood[1].toLowerCase()}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <Fieldset
          title="Identity and framing"
          description="Set the face and short positioning recruiters will see when they browse the persona library."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="ci-name" className="text-sm font-medium text-[#0a1d08]">
                  Persona name
                </label>
                <Input
                  id="ci-name"
                  value={form.name}
                  placeholder="e.g., Skeptical Sam"
                  disabled={isSubmitting}
                  className="rounded-[18px] border-[#dfe4d4] bg-[#fbfdf6]"
                  required
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="ci-description"
                  className="text-sm font-medium text-[#0a1d08]"
                >
                  Persona description
                </label>
                <Textarea
                  id="ci-description"
                  value={form.description}
                  placeholder="Summarize how this interviewer shows up in the room, what they prioritize, and the kind of candidate conversation they create."
                  rows={4}
                  disabled={isSubmitting}
                  className="rounded-[18px] border-[#dfe4d4] bg-[#fbfdf6] leading-6"
                  required
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#0a1d08]">
                    Portrait selection
                  </p>
                  <p className="text-xs leading-5 text-[#5e6958]">
                    Choose the visual identity recruiters will recognize in the
                    library.
                  </p>
                </div>
                <div className="rounded-full border border-[#d7e8b5] bg-[#f8fbf0] px-3 py-1 text-xs text-[#203b14]">
                  Required
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {avatars.map((avatar) => {
                  const selected = form.image === avatar.img;

                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      aria-label={`Avatar option ${avatar.id}`}
                      aria-pressed={selected}
                      disabled={isSubmitting}
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-[20px] border bg-[#fbfdf6] transition-all",
                        selected
                          ? "border-[#203b14] shadow-[0_0_0_2px_rgba(32,59,20,0.12)]"
                          : "border-[#dfe4d4] hover:border-[#203b14]/50",
                      )}
                      onClick={() => setField("image", avatar.img)}
                    >
                      <Image
                        src={avatar.img}
                        alt={`Avatar ${avatar.id}`}
                        sizes="96px"
                        className="object-cover object-center"
                        fill
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Fieldset>

        <Fieldset
          title="Voice and conversation stance"
          description="Choose how the interviewer sounds, then tune the visible interaction traits that help recruiters understand the personality."
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#f8fbf0] p-4">
                <label
                  htmlFor="ci-voice"
                  className="flex items-center gap-2 text-sm font-medium text-[#0a1d08]"
                >
                  <Mic2 className="h-4 w-4 text-[#203b14]" />
                  Voice selection
                </label>
                <p className="mt-2 text-xs leading-5 text-[#5e6958]">
                  This is the delivery layer candidates hear during the
                  interview.
                </p>
                <Select
                  value={form.voice_id}
                  disabled={isSubmitting}
                  onValueChange={(v) => setField("voice_id", v)}
                >
                  <SelectTrigger
                    id="ci-voice"
                    className="mt-4 rounded-[18px] border-[#dfe4d4] bg-[#fbfdf6]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <p className="text-sm font-medium text-[#0a1d08]">
                  Recruiter shorthand
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#42513d]">
                  <li>Use empathy for warmth and candidate comfort.</li>
                  <li>Use rapport for ease and conversational chemistry.</li>
                  <li>Use exploration for probing depth and curiosity.</li>
                  <li>Use pace for how quickly the interviewer moves.</li>
                </ul>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TraitSlider
                label="Empathy"
                description={traitDescription(form.empathy, "empathy")}
                value={form.empathy}
                disabled={isSubmitting}
                onChange={(v) => setField("empathy", v)}
              />
              <TraitSlider
                label="Rapport"
                description={traitDescription(form.rapport, "rapport")}
                value={form.rapport}
                disabled={isSubmitting}
                onChange={(v) => setField("rapport", v)}
              />
              <TraitSlider
                label="Exploration"
                description={traitDescription(form.exploration, "exploration")}
                value={form.exploration}
                disabled={isSubmitting}
                onChange={(v) => setField("exploration", v)}
              />
              <TraitSlider
                label="Pace"
                description={traitDescription(form.speed, "speed")}
                value={form.speed}
                disabled={isSubmitting}
                onChange={(v) => setField("speed", v)}
              />
            </div>
          </div>
        </Fieldset>

        <Fieldset
          title="Interview philosophy"
          description="Write the prompt body that guides the interviewer’s tone, follow-up behavior, and guardrails. Candidate, role, duration, and question context are appended automatically."
        >
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="ci-prompt"
                className="flex items-center gap-2 text-sm font-medium text-[#0a1d08]"
              >
                  <MessageSquare className="h-4 w-4 text-[#203b14]" />
                Prompt body
              </label>
              <Textarea
                id="ci-prompt"
                value={form.promptBody}
                placeholder="Describe how this persona behaves: how they open, how they probe, what they avoid, and how direct or warm they should feel in the room."
                rows={10}
                className="min-h-[220px] rounded-[22px] border-[#dfe4d4] bg-[#fbfdf6] font-mono text-xs leading-6"
                disabled={isSubmitting}
                required
                onChange={(e) => setField("promptBody", e.target.value)}
              />
            </div>

            <div className="rounded-[24px] border border-dashed border-[#c5ccb6] bg-[#f8fbf0] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[#6b7568]">
                Locked context footer
              </p>
              <p className="mt-2 text-sm leading-6 text-[#42513d]">
                This context is appended automatically so every persona receives
                the candidate name, role objective, timing, and question set in
                a consistent format.
              </p>
              <pre className="mt-4 whitespace-pre-wrap break-words rounded-[18px] border border-[#e0e5d5] bg-[#fbfdf6] p-4 font-mono text-xs leading-6 text-[#5e6958]">
                {PROMPT_FOOTER_TEMPLATE}
              </pre>
            </div>
          </div>
        </Fieldset>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-[22px] border border-[#b86a54] bg-[#fff5f1] p-4 text-sm text-[#7c2d12]"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-[#e0e5d5] pt-2">
          <Button
            type="button"
            variant="ghost"
            className="rounded-full px-5"
            disabled={isSubmitting}
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button type="submit" className="rounded-full px-5" disabled={submitDisabled}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating persona...
              </>
            ) : (
              "Create persona"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateInterviewerModal;
