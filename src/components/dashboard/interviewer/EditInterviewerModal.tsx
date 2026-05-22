"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Mic2 } from "lucide-react";

import Modal from "@/components/dashboard/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInterviewers,
  type InterviewerPatch,
} from "@/contexts/interviewers.context";
import { PROMPT_FOOTER_TEMPLATE, VOICE_OPTIONS } from "@/lib/constants";
import { stripFooter } from "@/lib/promptFooter";
import { avatars } from "@/components/dashboard/interviewer/avatars";
import { Fieldset } from "@/components/dashboard/interviewer/shared/Fieldset";
import { TraitSlider } from "@/components/dashboard/interviewer/shared/TraitSlider";
import { AvatarGrid } from "@/components/dashboard/interviewer/shared/AvatarGrid";
import { traitDescription } from "@/components/dashboard/interviewer/shared/traitCopy";
import type { Interviewer } from "@/types/interviewer";

interface Props {
  open: boolean;
  interviewer: Interviewer;
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

function initialStateFrom(interviewer: Interviewer): FormState {
  return {
    name: interviewer.name ?? "",
    description: interviewer.description ?? "",
    image: interviewer.image ?? "",
    voice_id: interviewer.voice_id ?? VOICE_OPTIONS[0]?.id ?? "",
    promptBody: stripFooter(interviewer.prompt ?? ""),
    empathy: interviewer.empathy ?? 5,
    rapport: interviewer.rapport ?? 5,
    exploration: interviewer.exploration ?? 5,
    speed: interviewer.speed ?? 5,
  };
}

// Build the patch body containing only fields whose values differ from the
// stored row. Empty patches are short-circuited at submit time to avoid an
// unnecessary 400 from the API.
function diffPatch(initial: FormState, current: FormState): InterviewerPatch {
  const patch: InterviewerPatch = {};
  if (current.name.trim() !== initial.name.trim()) patch.name = current.name.trim();
  if (current.description.trim() !== initial.description.trim()) {
    patch.description = current.description.trim();
  }
  if (current.image !== initial.image) patch.image = current.image;
  if (current.voice_id !== initial.voice_id) patch.voice_id = current.voice_id;
  if (current.promptBody.trim() !== initial.promptBody.trim()) {
    patch.prompt = current.promptBody.trim();
  }
  if (current.empathy !== initial.empathy) patch.empathy = current.empathy;
  if (current.rapport !== initial.rapport) patch.rapport = current.rapport;
  if (current.exploration !== initial.exploration) patch.exploration = current.exploration;
  if (current.speed !== initial.speed) patch.speed = current.speed;

return patch;
}

function EditInterviewerModal({ open, interviewer, onClose }: Props) {
  const { updateInterviewer } = useInterviewers();
  const [initial, setInitial] = useState<FormState>(() => initialStateFrom(interviewer));
  const [form, setForm] = useState<FormState>(() => initialStateFrom(interviewer));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Re-hydrate the form whenever the modal is opened or the underlying
  // interviewer changes (e.g., parent passed a fresh row after refetch).
  useEffect(() => {
    if (open) {
      const next = initialStateFrom(interviewer);
      setInitial(next);
      setForm(next);
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [open, interviewer]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const patch = diffPatch(initial, form);
    if (Object.keys(patch).length === 0) {
      onClose();

return;
    }

    setIsSubmitting(true);

    try {
      await updateInterviewer(Number(interviewer.id), patch);
      onClose();
    } catch (err) {
      const e = err as Error & { type?: string; status?: number };
      if (e.status === 422) {
        setErrorMessage(e.message || "Validation failed");
      } else if (e.type === "retell_failure") {
        setErrorMessage(
          "This change was rejected — your interviewer is unchanged. Check your input and try again.",
        );
      } else if (e.type === "db_failure") {
        setErrorMessage(
          "Your changes were applied to the AI model but could not be saved to the record. Saving again should fix it.",
        );
      } else {
        setErrorMessage("Failed to save changes — please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptRows = Math.min(
    18,
    Math.max(10, form.promptBody.split("\n").length + 2),
  );

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
      title="Edit interviewer persona"
      closeOnOutsideClick={!isSubmitting}
      onClose={handleClose}
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <Fieldset
          title="Identity and framing"
          description="Update the face and short positioning recruiters see in the persona library."
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="space-y-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="ei-name" className="text-sm font-medium text-[#0a1d08]">
                  Persona name
                </label>
                <Input
                  id="ei-name"
                  value={form.name}
                  placeholder="e.g., Skeptical Sam"
                  disabled={isSubmitting}
                  className="rounded-[18px] border-[#dfe4d4] bg-[#fbfdf6]"
                  required
                  onChange={(e) => setField("name", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="ei-description" className="text-sm font-medium text-[#0a1d08]">
                  Persona description
                </label>
                <Textarea
                  id="ei-description"
                  value={form.description}
                  placeholder="Summarize how this interviewer shows up in the room."
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
                  <p className="text-sm font-medium text-[#0a1d08]">Portrait selection</p>
                  <p className="text-xs leading-5 text-[#5e6958]">
                    Pick the visual identity recruiters will recognize.
                  </p>
                </div>
                <div className="rounded-full border border-[#d7e8b5] bg-[#f8fbf0] px-3 py-1 text-xs text-[#203b14]">
                  Required
                </div>
              </div>

              <AvatarGrid
                avatars={avatars}
                selectedImage={form.image}
                disabled={isSubmitting}
                onChange={(img) => setField("image", img)}
              />
            </div>
          </div>
        </Fieldset>

        <Fieldset
          title="Voice and conversation stance"
          description="Adjust how the interviewer sounds and tune the visible interaction traits."
        >
          <div className="grid gap-5">
            <div>
              <div className="rounded-[24px] border border-[#e0e5d5] bg-[#f8fbf0] p-4">
                <label
                  htmlFor="ei-voice"
                  className="flex items-center gap-2 text-sm font-medium text-[#0a1d08]"
                >
                  <Mic2 className="h-4 w-4 text-[#203b14]" />
                  Voice selection
                </label>
                <p className="mt-2 text-xs leading-5 text-[#5e6958]">
                  This is the delivery layer candidates hear during the interview.
                </p>
                <Select
                  value={form.voice_id}
                  disabled={isSubmitting}
                  onValueChange={(v) => setField("voice_id", v)}
                >
                  <SelectTrigger id="ei-voice" className="mt-4 rounded-[18px] border-[#dfe4d4] bg-[#fbfdf6]">
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

              <div className="mt-3 grid gap-3 md:grid-cols-2">
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
          </div>
        </Fieldset>

        <Fieldset
          title="Interview philosophy"
          description="Edit the prompt body that guides this interviewer’s tone, follow-ups, and guardrails. The candidate/role context footer is appended automatically."
        >
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="ei-prompt"
                className="flex items-center gap-2 text-sm font-medium text-[#0a1d08]"
              >
                <MessageSquare className="h-4 w-4 text-[#203b14]" />
                Prompt body
              </label>
              <Textarea
                id="ei-prompt"
                value={form.promptBody}
                placeholder="Describe how this persona behaves: how they open, how they probe, what they avoid."
                rows={promptRows}
                className="min-h-[240px] rounded-[22px] border-[#dfe4d4] bg-[#fbfdf6] font-mono text-xs leading-6"
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
                Appended automatically so every persona receives candidate name, role objective,
                timing, and question set in a consistent format.
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
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default EditInterviewerModal;
