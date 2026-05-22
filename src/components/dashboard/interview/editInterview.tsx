"use client";

import { ArrowLeft, Plus, SaveIcon, TrashIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import QuestionCard from "@/components/dashboard/interview/create-popup/QuestionCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useInterviewers } from "@/contexts/interviewers.context";
import { useInterviews } from "@/contexts/interviews.context";
import { InterviewService } from "@/services/interviews.service";
import type { Interview, Question } from "@/types/interview";
import { CardTitle } from "../../ui/card";

type EditInterviewProps = {
  interview: Interview | undefined;
};

function FieldLabel({
  title,
  note,
}: {
  title: string;
  note?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-[#0a1d08]">{title}</p>
      {note ? <p className="text-xs text-[#6f7866]">{note}</p> : null}
    </div>
  );
}

function EditInterview({ interview }: EditInterviewProps) {
  const { interviewers } = useInterviewers();
  const { fetchInterviews } = useInterviews();
  const router = useRouter();

  const [description, setDescription] = useState<string>(interview?.description || "");
  const [objective, setObjective] = useState<string>(interview?.objective || "");
  const [numQuestions, setNumQuestions] = useState<number>(interview?.question_count || 1);
  const [duration, setDuration] = useState<number>(Number(interview?.time_duration));
  const [questions, setQuestions] = useState<Question[]>(interview?.questions || []);
  const [selectedInterviewer, setSelectedInterviewer] = useState(interview?.interviewer_id);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(interview?.is_anonymous || false);
  const [inviteOnly, setInviteOnly] = useState<boolean>(interview?.invite_only || false);
  const [inviteOnlyConflictDialogOpen, setInviteOnlyConflictDialogOpen] = useState<boolean>(false);
  const [proctoringCameraEnabled, setProctoringCameraEnabled] = useState<boolean>(
    Boolean(interview?.proctoring_camera_enabled),
  );
  const [proctoringScreenEnabled, setProctoringScreenEnabled] = useState<boolean>(
    Boolean(interview?.proctoring_screen_enabled),
  );
  const [isClicked, setIsClicked] = useState(false);

  const endOfListRef = useRef<HTMLDivElement>(null);
  const prevQuestionLengthRef = useRef(questions.length);

  const handleInputChange = (id: string, newQuestion: Question) => {
    setQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, ...newQuestion } : question,
      ),
    );
  };

  const handleDeleteQuestion = (id: string) => {
    if (questions.length === 1) {
      setQuestions(
        questions.map((question) => ({
          ...question,
          question: "",
          follow_up_count: 1,
        })),
      );

      return;
    }

    setQuestions(questions.filter((question) => question.id !== id));
    setNumQuestions(numQuestions - 1);
  };

  const handleAddQuestion = () => {
    if (questions.length < numQuestions) {
      setQuestions([...questions, { id: uuidv4(), question: "", follow_up_count: 1 }]);
    }
  };

  const onSave = async () => {
    const questionCount = questions.length < numQuestions ? questions.length : numQuestions;

    const interviewData = {
      objective,
      questions,
      interviewer_id: Number(selectedInterviewer),
      question_count: questionCount,
      time_duration: Number(duration),
      description,
      is_anonymous: isAnonymous,
      invite_only: inviteOnly,
      proctoring_camera_enabled: proctoringCameraEnabled,
      proctoring_screen_enabled: proctoringScreenEnabled,
    };

    try {
      if (!interview) {
        return;
      }

      await InterviewService.updateInterview(interviewData, interview.id);
      setIsClicked(false);
      fetchInterviews();
      toast.success("Interview updated successfully.", {
        position: "bottom-right",
        duration: 3000,
      });
      router.push(`/jobs/${interview.id}`);
    } catch (error) {
      console.error("Error updating interview:", error);
    }
  };

  const onDeleteInterviewClick = async () => {
    if (!interview) {
      return;
    }

    try {
      await InterviewService.deleteInterview(interview.id);
      router.push("/dashboard");
    } catch (error) {
      console.error("Error deleting interview:", error);
      toast.error("Failed to delete the interview.", {
        position: "bottom-right",
        duration: 3500,
      });
    }
  };

  useEffect(() => {
    if (questions.length > prevQuestionLengthRef.current) {
      endOfListRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevQuestionLengthRef.current = questions.length;
  }, [questions.length]);

  return (
    <div className="space-y-8 text-[#0a1d08]">
      {/* Page header — slim and informative. The full job-workspace HeaderActions
          don't belong in edit mode (the only relevant actions are Back / Save / Delete). */}
      <header className="flex flex-col gap-5 border-b border-[#e0e5d5] pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-[#53614d] transition-colors hover:text-[#0a1d08]"
            onClick={() => {
              router.push(`/jobs/${interview?.id}`);
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </button>
          <div className="space-y-1">
            <p
              className="text-[11px] uppercase tracking-[0.18em] text-[#6f7866]"
              style={{ fontFamily: "var(--font-fragmentmono)" }}
            >
              Editing interview
            </p>
            <h1 className="truncate text-2xl font-semibold leading-[1.05] tracking-[-0.04em] md:text-[28px]">
              {interview?.name || "Untitled interview"}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={isClicked}
                className="rounded-full border border-[#d7bdb7] bg-transparent px-4 text-[#6b3f31] hover:bg-[#f6ebe7]"
                variant="ghost"
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this interview?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the interview and every candidate response attached to
                  it. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-[#6b3f31] text-[#fbfdf6] hover:bg-[#5a3327]"
                  onClick={async () => {
                    await onDeleteInterviewClick();
                  }}
                >
                  Delete interview
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            disabled={isClicked}
            className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
            onClick={() => {
              setIsClicked(true);
              onSave();
            }}
          >
            <SaveIcon className="mr-2 h-4 w-4" />
            Save changes
          </Button>
        </div>
      </header>

      {/* Two-column layout. Balanced so neither side towers over the other:
            Left  — candidate-visible copy + access controls (short fields)
            Right — interviewer persona + question flow (the tall content) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Interview description"
              note="Candidates will see this before they begin."
            />
            <textarea
              value={description}
              className="mt-4 min-h-[140px] w-full rounded-[22px] border border-[#d8ddd0] bg-[#f8faf3] px-4 py-4 text-sm leading-6 text-[#0a1d08] outline-none transition-colors focus:border-[#4a3212]"
              placeholder="Describe the role, the purpose of the interview, and what a candidate should expect."
              rows={5}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={(event) => setDescription(event.target.value.trim())}
            />
          </div>

          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Interview objective"
              note="Internal hiring brief. Only the AI interviewer reads this."
            />
            <textarea
              value={objective}
              className="mt-4 min-h-[140px] w-full rounded-[22px] border border-[#d8ddd0] bg-[#f8faf3] px-4 py-4 text-sm leading-6 text-[#0a1d08] outline-none transition-colors focus:border-[#4a3212]"
              placeholder="Explain what strong performance looks like and what the interviewer should probe for."
              rows={5}
              onChange={(event) => setObjective(event.target.value)}
              onBlur={(event) => setObjective(event.target.value.trim())}
            />
          </div>

          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Candidate identity"
              note="Whether the workflow should collect candidate names and emails."
            />
            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a1d08]">
                      Collect anonymous responses
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#53614d]">
                      Hide name and email collection from the candidate journey.
                    </p>
                  </div>
                  <Switch
                    checked={isAnonymous}
                    className={isAnonymous ? "bg-[#4a3212]" : "bg-white"}
                    onCheckedChange={(checked) => {
                      // OD1: anonymous + invite-only are incompatible. If the
                      // user turns anonymous ON while invite_only is already
                      // ON, confirm before silently disabling invite-only.
                      if (checked && inviteOnly) {
                        setInviteOnlyConflictDialogOpen(true);

                        return;
                      }
                      setIsAnonymous(checked);
                    }}
                  />
                </div>
              </div>

              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0a1d08]">Invite-only access</p>
                    <p className="mt-1 text-sm leading-6 text-[#53614d]">
                      Only candidates with a personal invite link can start this interview.
                      {isAnonymous ? (
                        <span className="mt-1 block text-[#7d4f1f]">
                          Disable anonymous mode to use invite-only.
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Switch
                    checked={inviteOnly}
                    disabled={isAnonymous}
                    className={inviteOnly ? "bg-[#4a3212]" : "bg-white"}
                    onCheckedChange={(checked) => setInviteOnly(checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Proctoring"
              note="Optional camera + screen recording for manual review."
            />
            <div className="mt-5 space-y-3">
              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="proctoring-camera-enabled"
                      className="text-sm font-semibold text-[#0a1d08]"
                    >
                      Record candidate camera
                    </label>
                    <p className="mt-1 text-sm leading-6 text-[#53614d]">
                      Record a camera feed of the candidate for the duration of the session.
                      Candidates must consent before starting.
                    </p>
                  </div>
                  <Switch
                    id="proctoring-camera-enabled"
                    checked={proctoringCameraEnabled}
                    className={proctoringCameraEnabled ? "bg-[#4a3212]" : "bg-white"}
                    onCheckedChange={(checked) =>
                      setProctoringCameraEnabled(checked)
                    }
                  />
                </div>
              </div>

              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label
                      htmlFor="proctoring-screen-enabled"
                      className="text-sm font-semibold text-[#0a1d08]"
                    >
                      Record candidate screen
                    </label>
                    <p className="mt-1 text-sm leading-6 text-[#53614d]">
                      Record the candidate&apos;s full screen during the session. Only a
                      full-screen share is accepted — windows or tabs are rejected. Candidates
                      must consent before starting.
                    </p>
                  </div>
                  <Switch
                    id="proctoring-screen-enabled"
                    checked={proctoringScreenEnabled}
                    className={proctoringScreenEnabled ? "bg-[#4a3212]" : "bg-white"}
                    onCheckedChange={(checked) =>
                      setProctoringScreenEnabled(checked)
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Interviewer persona"
              note="The AI interviewer who represents this job to candidates."
            />
            <ScrollArea className="mt-5 whitespace-nowrap">
              <div className="flex gap-3 pb-2">
                {interviewers.map((item) => {
                  const isSelected = selectedInterviewer === item.id;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`min-w-[200px] rounded-[24px] border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-[#203b14] bg-[#eef4e1]"
                          : "border-[#e0e5d5] bg-[#f8faf3] hover:border-[#c5ccb6]"
                      }`}
                      onClick={() => {
                        setSelectedInterviewer(item.id);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-[#d8ddd0]">
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={56}
                            height={56}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">{item.name}</CardTitle>
                          <p className="mt-1 line-clamp-2 whitespace-normal text-sm leading-5 text-[#53614d]">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <FieldLabel
                title="Question flow"
                note="The prompts the AI interviewer will work through with candidates."
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="rounded-[18px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-3 text-sm transition-colors focus-within:border-[#4a3212]">
                  <span
                    className="block text-[10px] uppercase tracking-[0.14em] text-[#6f7866]"
                    style={{ fontFamily: "var(--font-fragmentmono)" }}
                  >
                    Questions
                  </span>
                  <input
                    type="number"
                    step="1"
                    max="5"
                    min={questions.length.toString()}
                    className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
                    value={numQuestions}
                    onChange={(event) => {
                      let value = event.target.value;
                      if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                        if (Number(value) > 5) {
                          value = "5";
                        }
                        setNumQuestions(Number(value));
                      }
                    }}
                  />
                </label>
                <label className="rounded-[18px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-3 text-sm transition-colors focus-within:border-[#4a3212]">
                  <span
                    className="block text-[10px] uppercase tracking-[0.14em] text-[#6f7866]"
                    style={{ fontFamily: "var(--font-fragmentmono)" }}
                  >
                    Duration · min
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="mt-1 w-full bg-transparent text-lg font-semibold outline-none"
                    value={Number(duration)}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                        setDuration(Number(value));
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <ScrollArea className="mt-5 max-h-[640px] rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] p-4">
              {questions.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-[#6f7866]">
                  No questions yet. Use the + below to add one.
                </p>
              ) : (
                questions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    questionNumber={index + 1}
                    questionData={question}
                    onDelete={handleDeleteQuestion}
                    onQuestionChange={handleInputChange}
                  />
                ))
              )}
              <div ref={endOfListRef} />
              {questions.length < numQuestions ? (
                <button
                  type="button"
                  aria-label="Add question"
                  className="mx-auto mt-2 flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-[#c5ccb6] bg-[#fbfdf6] text-[#203b14] transition-colors hover:border-[#203b14] hover:bg-[#eef4e1]"
                  onClick={handleAddQuestion}
                >
                  <Plus className="h-5 w-5" />
                </button>
              ) : null}
            </ScrollArea>
          </div>
        </div>
      </div>

      <AlertDialog
        open={inviteOnlyConflictDialogOpen}
        onOpenChange={setInviteOnlyConflictDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off invite-only mode?</AlertDialogTitle>
            <AlertDialogDescription>
              Enabling anonymous mode will turn off invite-only access. Existing invites will remain
              in the database but will no longer be required to start this interview.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#4a3212] text-[#fbfdf6] hover:bg-[#3d2910]"
              onClick={() => {
                setInviteOnly(false);
                setIsAnonymous(true);
                setInviteOnlyConflictDialogOpen(false);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default EditInterview;
