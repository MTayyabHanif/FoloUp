"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import ReactAudioPlayer from "react-audio-player";
import { marked } from "marked";
import {
  AlertTriangle,
  ArrowLeft,
  DownloadIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { Analytics, CallData } from "@/types/response";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResponseService } from "@/services/responses.service";
import { InterviewService } from "@/services/interviews.service";
import { humanizeDisconnectionReason } from "@/lib/disconnectionReasons";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import QuestionAnswerCard from "@/components/dashboard/interview/questionAnswerCard";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CandidateStatus } from "@/lib/enum";

function ScoreGauge({
  value,
  maxValue = 100,
  size = 112,
  strokeWidth = 8,
  label,
}: {
  value: number;
  maxValue?: number;
  size?: number;
  strokeWidth?: number;
  label?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / maxValue));
  const dash = circumference * pct;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={typeof label === "string" ? label : `score ${value}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#dde4d2"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#203b14"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-[#203b14]">
        {label ?? value}
      </div>
    </div>
  );
}

function SessionCoverageRow({
  status,
  questionsCovered,
  questionCount,
  disconnectionReason,
}: {
  status: string | null;
  questionsCovered: number | null;
  questionCount: number | null;
  disconnectionReason: string | null;
}) {
  if (!status) {
    return null;
  }

  const reasonLabel = humanizeDisconnectionReason(disconnectionReason);
  const isInterruptedLike =
    status === "interrupted" || status === "abandoned";

  let coverageNode: React.ReactNode = null;
  if (questionsCovered === null) {
    coverageNode = (
      <span className="text-sm text-[#6f7866]">Coverage: analyzing...</span>
    );
  } else {
    const cap = questionCount ?? questionsCovered;
    const label = `${questionsCovered} of ${cap} questions covered`;
    let color = "text-[#203b14]";
    if (questionsCovered === 0) {
      color = "text-[#8b6d4d]";
    } else if (questionCount !== null && questionsCovered >= questionCount) {
      color = "text-[#203b14]";
    }

    coverageNode = <span className={`text-sm font-semibold ${color}`}>{label}</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[18px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-3">
      {coverageNode}
      {isInterruptedLike && reasonLabel ? (
        <>
          <span className="text-sm text-[#6f7866]" aria-hidden="true">
            ·
          </span>
          <span className="text-sm text-[#53614d]">{reasonLabel}</span>
        </>
      ) : null}
    </div>
  );
}

function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
        {title}
      </p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

type CallProps = {
  call_id: string;
  onDeleteResponse: (deletedCallId: string) => void;
  onCandidateStatusChange: (callId: string, newStatus: string) => void;
};

function CallInfo({
  call_id,
  onDeleteResponse,
  onCandidateStatusChange,
}: CallProps) {
  const [call, setCall] = useState<CallData>();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isClicked, setIsClicked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [candidateStatus, setCandidateStatus] = useState<string>("");
  const [interviewId, setInterviewId] = useState<string>("");
  const [tabSwitchCount, setTabSwitchCount] = useState<number>();
  const [responseStatus, setResponseStatus] = useState<string | null>(null);
  const [disconnectionReason, setDisconnectionReason] = useState<string | null>(
    null,
  );
  const [questionsCovered, setQuestionsCovered] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const fetchResponseDetails = async () => {
      setIsLoading(true);
      setCall(undefined);
      setEmail("");
      setName("");

      try {
        const [callResponse, responseRecord] = await Promise.all([
          axios.post("/api/get-call", { id: call_id }),
          ResponseService.getResponseByCallId(call_id),
        ]);

        if (!isMounted) {
          return;
        }

        setCall(callResponse.data.callResponse);
        setAnalytics(callResponse.data.analytics);
        setEmail(responseRecord?.email ?? "");
        setName(responseRecord?.name ?? "");
        setCandidateStatus(responseRecord?.candidate_status ?? "");
        setInterviewId(responseRecord?.interview_id ?? "");
        setTabSwitchCount(responseRecord?.tab_switch_count);
        setResponseStatus(responseRecord?.status ?? null);
        setDisconnectionReason(responseRecord?.disconnection_reason ?? null);
        setQuestionsCovered(
          typeof responseRecord?.questions_covered === "number"
            ? responseRecord.questions_covered
            : null,
        );

        if (responseRecord?.interview_id) {
          try {
            const interview = await InterviewService.getInterviewById(
              responseRecord.interview_id,
            );
            if (isMounted) {
              setQuestionCount(
                typeof interview?.question_count === "number"
                  ? interview.question_count
                  : null,
              );
            }
          } catch {
            if (isMounted) {
              setQuestionCount(null);
            }
          }
        } else if (isMounted) {
          setQuestionCount(null);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchResponseDetails();

    return () => {
      isMounted = false;
    };
  }, [call_id]);

  useEffect(() => {
    const replaceAgentAndUser = (rawTranscript: string, candidateName: string) => {
      const agentReplacement = "**AI interviewer:**";
      const userReplacement = `**${candidateName}:**`;

      let updatedTranscript = rawTranscript
        .replace(/Agent:/g, agentReplacement)
        .replace(/User:/g, userReplacement);

      updatedTranscript = updatedTranscript.replace(/(?:\r\n|\r|\n)/g, "\n\n");

      return updatedTranscript;
    };

    if (call && name) {
      setTranscript(replaceAgentAndUser(call.transcript as string, name));
    }
  }, [call, name]);

  const onDeleteResponseClick = async () => {
    try {
      const response = await ResponseService.getResponseByCallId(call_id);

      if (response) {
        const currentInterviewId = response.interview_id;
        await ResponseService.deleteResponse(call_id);
        router.push(`/interviews/${currentInterviewId}`);
        onDeleteResponse(call_id);
      }

      toast.success("Response deleted successfully.", {
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error deleting response:", error);

      toast.error("Failed to delete the response.", {
        position: "bottom-right",
        duration: 3000,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center">
        <LoaderWithText />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#0a1d08]">
      <div className="rounded-[28px] border border-[#e0e5d5] bg-[#f6f8ef] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-sm font-semibold text-[#203b14] transition-colors hover:border-[#c5ccb6] hover:bg-[#eef4e1]"
              onClick={() => {
                router.push(`/interviews/${interviewId}`);
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </button>

            <div className="flex flex-wrap items-start gap-4">
              <Avatar className="h-14 w-14 border border-[#d8ddd0] bg-[#eef4e1]">
                <AvatarFallback className="bg-transparent text-[#203b14]">
                  {name ? name[0] : "A"}
                </AvatarFallback>
              </Avatar>
              <div>
                {name ? (
                  <p className="text-2xl font-semibold tracking-[-0.04em]">
                    {name}
                  </p>
                ) : (
                  <p className="text-2xl font-semibold tracking-[-0.04em]">
                    Anonymous candidate
                  </p>
                )}
                {email ? (
                  <p className="mt-1 text-sm text-[#53614d]">{email}</p>
                ) : null}
              </div>
            </div>

            <SessionCoverageRow
              status={responseStatus}
              questionsCovered={questionsCovered}
              questionCount={questionCount}
              disconnectionReason={disconnectionReason}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={candidateStatus}
              onValueChange={async (newValue: string) => {
                setCandidateStatus(newValue);
                await ResponseService.updateResponse(
                  { candidate_status: newValue },
                  call_id,
                );
                onCandidateStatusChange(call_id, newValue);
              }}
            >
              <SelectTrigger className="w-[200px] rounded-full border-[#e0e5d5] bg-[#fbfdf6]">
                <SelectValue placeholder="Candidate status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CandidateStatus.NO_STATUS}>
                  No Status
                </SelectItem>
                <SelectItem value={CandidateStatus.NOT_SELECTED}>
                  Not Selected
                </SelectItem>
                <SelectItem value={CandidateStatus.POTENTIAL}>
                  Potential
                </SelectItem>
                <SelectItem value={CandidateStatus.SELECTED}>
                  Selected
                </SelectItem>
              </SelectContent>
            </Select>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={isClicked}
                  className="rounded-full border border-[#d7bdb7] bg-[#f6ebe7] px-5 text-[#6b3f31] hover:bg-[#f0dfd8]"
                  variant="ghost"
                >
                  <TrashIcon className="mr-2 h-4 w-4" />
                  Delete response
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this response?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The candidate session and its recruiter review surface will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>

                  <AlertDialogAction
                    className="bg-[#4a3212] text-[#fbfdf6] hover:bg-[#3d2910]"
                    onClick={async () => {
                      setIsClicked(true);
                      await onDeleteResponseClick();
                    }}
                  >
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {tabSwitchCount && tabSwitchCount > 0 ? (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#d7bdb7] bg-[#f6ebe7] px-4 py-2 text-sm font-semibold text-[#6b3f31]">
            <AlertTriangle className="h-4 w-4" />
            Tab switching detected
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {analytics?.overallScore !== undefined ? (
          <DetailCard title="Overall hiring score">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
              <ScoreGauge
                value={analytics.overallScore ?? 0}
                maxValue={100}
                size={112}
                strokeWidth={4}
                label={analytics.overallScore}
              />
              <div className="text-sm leading-6 text-[#53614d]">
                <p className="font-semibold text-[#0a1d08]">Hiring signal</p>
                <p className="mt-2">
                  {analytics.overallFeedback === undefined ? (
                    <Skeleton className="h-5 w-[220px]" />
                  ) : (
                    analytics.overallFeedback
                  )}
                </p>
              </div>
            </div>
          </DetailCard>
        ) : null}

        {analytics?.communication ? (
          <DetailCard title="Communication">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center">
              <ScoreGauge
                value={analytics.communication.score ?? 0}
                maxValue={10}
                size={112}
                strokeWidth={4}
                label={
                  <div className="flex items-baseline">
                    {analytics.communication.score ?? 0}
                    <span className="ml-0.5 text-xl">/10</span>
                  </div>
                }
              />
              <div className="text-sm leading-6 text-[#53614d]">
                <p className="font-semibold text-[#0a1d08]">Feedback</p>
                <p className="mt-2">
                  {analytics.communication.feedback === undefined ? (
                    <Skeleton className="h-5 w-[220px]" />
                  ) : (
                    analytics.communication.feedback
                  )}
                </p>
              </div>
            </div>
          </DetailCard>
        ) : null}

        <DetailCard title="Session integrity">
          <div className="space-y-4 text-sm leading-6 text-[#53614d]">
            <div>
              <p className="font-semibold text-[#0a1d08]">Sentiment</p>
              <p className="mt-1">
                {call?.call_analysis?.user_sentiment === undefined ? (
                  <Skeleton className="h-5 w-[160px]" />
                ) : (
                  call.call_analysis.user_sentiment
                )}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#0a1d08]">Call summary</p>
              <p className="mt-1">
                {call?.call_analysis?.call_summary === undefined ? (
                  <Skeleton className="h-5 w-[220px]" />
                ) : (
                  call.call_analysis.call_summary
                )}
              </p>
            </div>
            <p className="rounded-[18px] border border-[#e0e5d5] bg-[#f8faf3] px-4 py-3">
              {call?.call_analysis?.call_completion_rating_reason}
            </p>
          </div>
        </DetailCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DetailCard title="Interview recording">
          <div className="space-y-4">
            {call?.recording_url ? (
              <>
                <ReactAudioPlayer src={call.recording_url} controls />
                <a
                  href={call.recording_url}
                  download=""
                  aria-label="Download recording"
                  className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-sm font-semibold text-[#0a1d08] transition-colors hover:border-[#c5ccb6] hover:bg-[#eef4e1]"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Download audio
                </a>
              </>
            ) : (
              <p className="text-sm text-[#53614d]">
                No recording is available for this response.
              </p>
            )}
          </div>
        </DetailCard>

        {analytics && analytics.questionSummaries && analytics.questionSummaries.length > 0 ? (
          <DetailCard title="Question summaries">
            <ScrollArea className="max-h-[320px] pr-1">
              <div className="space-y-3">
                {analytics.questionSummaries.map((qs, index) => (
                  <QuestionAnswerCard
                    key={qs.question}
                    questionNumber={index + 1}
                    question={qs.question}
                    answer={qs.summary}
                  />
                ))}
              </div>
            </ScrollArea>
          </DetailCard>
        ) : null}
      </div>

      <DetailCard title="Transcript">
        <ScrollArea className="h-[480px] pr-1">
          <div
            className="rounded-[22px] border border-[#e0e5d5] bg-[#f8faf3] p-5 text-sm leading-7 text-[#0a1d08]"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: marked(transcript) }}
          />
        </ScrollArea>
      </DetailCard>
    </div>
  );
}

export default CallInfo;
