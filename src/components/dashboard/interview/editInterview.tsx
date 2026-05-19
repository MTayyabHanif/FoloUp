"use client";

import React, { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { ArrowLeft, Plus, SaveIcon, TrashIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type { Interview, Question } from "@/types/interview";
import { useInterviewers } from "@/contexts/interviewers.context";
import QuestionCard from "@/components/dashboard/interview/create-popup/QuestionCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useInterviews } from "@/contexts/interviews.context";
import { InterviewService } from "@/services/interviews.service";
import { CardTitle } from "../../ui/card";
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

  const [description, setDescription] = useState<string>(
    interview?.description || "",
  );
  const [objective, setObjective] = useState<string>(
    interview?.objective || "",
  );
  const [numQuestions, setNumQuestions] = useState<number>(
    interview?.question_count || 1,
  );
  const [duration, setDuration] = useState<number>(
    Number(interview?.time_duration),
  );
  const [questions, setQuestions] = useState<Question[]>(
    interview?.questions || [],
  );
  const [selectedInterviewer, setSelectedInterviewer] = useState(
    interview?.interviewer_id,
  );
  const [isAnonymous, setIsAnonymous] = useState<boolean>(
    interview?.is_anonymous || false,
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
      setQuestions([
        ...questions,
        { id: uuidv4(), question: "", follow_up_count: 1 },
      ]);
    }
  };

  const onSave = async () => {
    const questionCount =
      questions.length < numQuestions ? questions.length : numQuestions;

    const interviewData = {
      objective,
      questions,
      interviewer_id: Number(selectedInterviewer),
      question_count: questionCount,
      time_duration: Number(duration),
      description,
      is_anonymous: isAnonymous,
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
      router.push(`/interviews/${interview.id}`);
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
    <div className="space-y-6 text-[#0a1d08]">
      <div className="rounded-[28px] border border-[#e0e5d5] bg-[#f6f8ef] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-sm font-semibold text-[#203b14] transition-colors hover:border-[#c5ccb6] hover:bg-[#eef4e1]"
              onClick={() => {
                router.push(`/interviews/${interview?.id}`);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </button>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
                Job settings
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">
                Refine the interview workflow
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#53614d]">
                Update the role context, interviewer, candidate anonymity, and question flow without leaving the workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={isClicked}
              className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
              onClick={() => {
                setIsClicked(true);
                onSave();
              }}
            >
              Save changes
              <SaveIcon className="ml-2 h-4 w-4" />
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isClicked}
                  className="rounded-full border border-[#d7bdb7] bg-[#f6ebe7] px-5 text-[#6b3f31] hover:bg-[#f0dfd8]"
                  variant="ghost"
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Delete workflow
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this interview?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the interview and its workspace.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-[#4a3212] text-[#fbfdf6] hover:bg-[#3d2910]"
                    onClick={async () => {
                      await onDeleteInterviewClick();
                    }}
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Interview description"
              note="Candidates will see this before they begin."
            />
            <textarea
              value={description}
              className="mt-4 min-h-[140px] w-full rounded-[22px] border border-[#d8ddd0] bg-[#f8faf3] px-4 py-4 text-sm leading-6 text-[#0a1d08] outline-none"
              placeholder="Describe the role, the purpose of the interview, and what a candidate should expect."
              rows={5}
              onChange={(event) => setDescription(event.target.value)}
              onBlur={(event) => setDescription(event.target.value.trim())}
            />
          </div>

          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Interview objective"
              note="Use this as the internal hiring brief for the AI interviewer."
            />
            <textarea
              value={objective}
              className="mt-4 min-h-[140px] w-full rounded-[22px] border border-[#d8ddd0] bg-[#f8faf3] px-4 py-4 text-sm leading-6 text-[#0a1d08] outline-none"
              placeholder="Explain what strong performance looks like and what the interviewer should probe for."
              rows={5}
              onChange={(event) => setObjective(event.target.value)}
              onBlur={(event) => setObjective(event.target.value.trim())}
            />
          </div>

          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <FieldLabel
                title="Question flow"
                note="Set the session length, question count, and the prompts the AI interviewer will use."
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="rounded-[20px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-3 text-sm">
                  <span className="block text-xs uppercase tracking-[0.12em] text-[#6f7866]">
                    Questions
                  </span>
                  <input
                    type="number"
                    step="1"
                    max="5"
                    min={questions.length.toString()}
                    className="mt-2 w-full bg-transparent text-lg font-semibold outline-none"
                    value={numQuestions}
                    onChange={(event) => {
                      let value = event.target.value;
                      if (
                        value === "" ||
                        (Number.isInteger(Number(value)) && Number(value) > 0)
                      ) {
                        if (Number(value) > 5) {
                          value = "5";
                        }
                        setNumQuestions(Number(value));
                      }
                    }}
                  />
                </label>
                <label className="rounded-[20px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-3 text-sm">
                  <span className="block text-xs uppercase tracking-[0.12em] text-[#6f7866]">
                    Duration (mins)
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="mt-2 w-full bg-transparent text-lg font-semibold outline-none"
                    value={Number(duration)}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (
                        value === "" ||
                        (Number.isInteger(Number(value)) && Number(value) > 0)
                      ) {
                        setDuration(Number(value));
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <ScrollArea className="mt-5 max-h-[560px] rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] p-4">
              {questions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  questionNumber={index + 1}
                  questionData={question}
                  onDelete={handleDeleteQuestion}
                  onQuestionChange={handleInputChange}
                />
              ))}
              <div ref={endOfListRef} />
              {questions.length < numQuestions ? (
                <button
                  type="button"
                  className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-[#c5ccb6] bg-[#fbfdf6] text-[#203b14] transition-colors hover:border-[#203b14] hover:bg-[#eef4e1]"
                  onClick={handleAddQuestion}
                >
                  <Plus className="h-6 w-6" />
                </button>
              ) : null}
            </ScrollArea>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            <FieldLabel
              title="Interviewer persona"
              note="Choose the interviewer who should represent this job during the candidate session."
            />
            <ScrollArea className="mt-5 whitespace-nowrap">
              <div className="flex gap-3 pb-2">
                {interviewers.map((item) => {
                  const isSelected = selectedInterviewer === item.id;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`min-w-[180px] rounded-[24px] border p-4 text-left transition-colors ${
                        isSelected
                          ? "border-[#203b14] bg-[#eef4e1]"
                          : "border-[#e0e5d5] bg-[#f8faf3] hover:border-[#c5ccb6]"
                      }`}
                      onClick={() => {
                        setSelectedInterviewer(item.id);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-full border border-[#d8ddd0]">
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={56}
                            height={56}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="truncate text-base">
                            {item.name}
                          </CardTitle>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#53614d]">
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
            <FieldLabel
              title="Candidate identity"
              note="Decide whether the workflow should collect candidate names and emails."
            />
            <div className="mt-5 rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#0a1d08]">
                    Collect anonymous responses
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[#53614d]">
                    When enabled, the candidate journey hides name and email collection.
                  </p>
                </div>
                <Switch
                  checked={isAnonymous}
                  className={isAnonymous ? "bg-[#4a3212]" : "bg-white"}
                  onCheckedChange={(checked) => setIsAnonymous(checked)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditInterview;
