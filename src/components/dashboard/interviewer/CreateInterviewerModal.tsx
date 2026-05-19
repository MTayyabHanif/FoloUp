"use client";

import { useState } from "react";
import Image from "next/image";
import { Loader2 } from "lucide-react";

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

function TraitSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return <div className="flex items-center gap-3">
    <span className="w-24 shrink-0 text-sm font-medium text-foreground">
      {label}
    </span>
    <div className="flex-1">
      <Slider
        value={[value]}
        min={1}
        max={10}
        step={1}
        disabled={disabled}
        onValueChange={(arr) => onChange(arr[0] ?? value)}
      />
    </div>
    <span className="w-8 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
      {value}
    </span>
  </div>
}

function CreateInterviewerModal({ open, onClose }: Props) {
  const { fetchInterviewers } = useInterviewers();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reset = () => {
    setForm(INITIAL_STATE);
    setErrorMessage(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) {return;}
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
          typeof body?.details === "string" && process.env.NODE_ENV !== "production"
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
      title="New interviewer"
      titleHidden={false}
      closeOnOutsideClick={!isSubmitting}
      onClose={handleClose}
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ci-name" className="text-sm font-medium">
            Name
          </label>
          <Input
            id="ci-name"
            value={form.name}
            placeholder="e.g., Skeptical Sam"
            disabled={isSubmitting}
            required
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ci-description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="ci-description"
            value={form.description}
            placeholder="Short blurb shown on the interviewer card."
            rows={2}
            disabled={isSubmitting}
            required
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>

        {/* Avatar picker (4x2 grid) */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Avatar</span>
          <div className="grid grid-cols-4 gap-2">
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
                    "relative aspect-square overflow-hidden rounded-lg transition-all",
                    selected
                      ? "ring-4 ring-brand-bold"
                      : "ring-1 ring-border hover:ring-2 hover:ring-brand-bold/50",
                  )}
                  onClick={() => setField("image", avatar.img)}
                >
                  <Image
                    src={avatar.img}
                    alt={`Avatar ${avatar.id}`}
                    sizes="80px"
                    className="object-cover object-center"
                    fill
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* Voice picker */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ci-voice" className="text-sm font-medium">
            Voice
          </label>
          <Select
            value={form.voice_id}
            disabled={isSubmitting}
            onValueChange={(v) => setField("voice_id", v)}
          >
            <SelectTrigger id="ci-voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Trait sliders */}
        <div className="flex flex-col gap-3">
          <div>
            <span className="text-sm font-medium">Interviewer settings</span>
            <p className="text-xs text-muted-foreground">
              Display only — does not affect interview behavior.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-6">
            <TraitSlider
              label="Empathy"
              value={form.empathy}
              disabled={isSubmitting}
              onChange={(v) => setField("empathy", v)}
            />
            <TraitSlider
              label="Exploration"
              value={form.exploration}
              disabled={isSubmitting}
              onChange={(v) => setField("exploration", v)}
            />
            <TraitSlider
              label="Rapport"
              value={form.rapport}
              disabled={isSubmitting}
              onChange={(v) => setField("rapport", v)}
            />
            <TraitSlider
              label="Speed"
              value={form.speed}
              disabled={isSubmitting}
              onChange={(v) => setField("speed", v)}
            />
          </div>
        </div>

        {/* Prompt body + locked footer */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ci-prompt" className="text-sm font-medium">
            System prompt
          </label>
          <Textarea
            id="ci-prompt"
            value={form.promptBody}
            placeholder="Describe how this interviewer behaves — their tone, what they probe, what they refuse to do. The candidate name, role, duration, and questions will be appended automatically (see locked footer below)."
            rows={8}
            className="font-mono text-xs"
            disabled={isSubmitting}
            required
            onChange={(e) => setField("promptBody", e.target.value)}
          />
          <div className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-secondary/50 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              Template footer — appended automatically (not editable)
            </span>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
              {PROMPT_FOOTER_TEMPLATE}
            </pre>
          </div>
        </div>

        {/* Error banner — pinned between body and footer */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitDisabled}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create interviewer"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateInterviewerModal;
