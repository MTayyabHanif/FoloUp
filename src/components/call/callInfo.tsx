"use client";

import axios from "axios";
import { AlertTriangle, ArrowLeft, DownloadIcon, RefreshCw, TrashIcon } from "lucide-react";
import { marked } from "marked";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import ReactAudioPlayer from "react-audio-player";
import { toast } from "sonner";

import { AnalyticsV2View } from "@/components/call/analyticsV2View";
import { DetailTextValue } from "@/components/call/detailTextValue";
import { formatCallTranscript } from "@/components/call/transcriptFormatter";
import QuestionAnswerCard from "@/components/dashboard/interview/questionAnswerCard";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { humanizeDisconnectionReason } from "@/lib/disconnectionReasons";
import { CandidateStatus } from "@/lib/enum";
import { InterviewService } from "@/services/interviews.service";
import { ResponseService } from "@/services/responses.service";
import type { Analytics, CallData } from "@/types/response";
import { isAnalyticsV2 } from "@/types/response";
import { ProctoringReview } from "@/components/call/proctoring/ProctoringReview";

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
  const isInterruptedLike = status === "interrupted" || status === "abandoned";

  let coverageNode: React.ReactNode = null;
  if (questionsCovered === null) {
    coverageNode = <span className="text-sm text-[#6f7866]">Coverage: analyzing...</span>;
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
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

type CallProps = {
  call_id: string;
  onDeleteResponse: (deletedCallId: string) => void;
  onCandidateStatusChange: (callId: string, newStatus: string) => void;
};

function CallInfo({ call_id, onDeleteResponse, onCandidateStatusChange }: CallProps) {
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
  const [disconnectionReason, setDisconnectionReason] = useState<string | null>(null);
  const [questionsCovered, setQuestionsCovered] = useState<number | null>(null);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  // v3 rubric-aware: surfaced when the interview was saved with the preflight
  // validator's "Save anyway" path (openspec rubric-aware-interviewer-and-questions §6.10).
  const [coverageWarnings, setCoverageWarnings] = useState<string[]>([]);
  const [coverageWarningsExpanded, setCoverageWarningsExpanded] =
    useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  // Proctoring state (openspec add-interview-proctoring-camera-screen).
  const [responseId, setResponseId] = useState<number | null>(null);
  const [proctoringCameraEnabled, setProctoringCameraEnabled] = useState(false);
  const [proctoringScreenEnabled, setProctoringScreenEnabled] = useState(false);
  const [cameraStoragePath, setCameraStoragePath] = useState<string | null>(null);
  const [screenStoragePath, setScreenStoragePath] = useState<string | null>(null);
  const [cameraStatus, setCameraStatus] = useState<string | null>(null);
  const [screenShareType, setScreenShareType] = useState<string | null>(null);
  const [proctoringInterrupted, setProctoringInterrupted] = useState(false);
  const [consentAcknowledgedAt, setConsentAcknowledgedAt] = useState<string | null>(null);
  const router = useRouter();

  const onReanalyzeClick = async () => {
    setIsReanalyzing(true);
    try {
      const { data } = await axios.post("/api/reanalyze-response", {
        callId: call_id,
      });
      setAnalytics(data.analytics);
      if (typeof data.questionsCovered === "number") {
        setQuestionsCovered(data.questionsCovered);
      }
      toast.success("Session re-analyzed.", {
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      const message =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any)?.response?.data?.error ||
        (error instanceof Error ? error.message : "Re-analyze failed");
      console.error("Re-analyze failed:", error);
      toast.error("Re-analyze failed.", {
        description: message,
        position: "bottom-right",
        duration: 4000,
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

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
        // Proctoring fields (may be undefined on legacy rows before migration).
        const r = responseRecord as
          | (typeof responseRecord & {
              id?: number;
              camera_storage_path?: string | null;
              screen_storage_path?: string | null;
              camera_status?: string | null;
              screen_share_type?: string | null;
              proctoring_interrupted?: boolean | null;
              consent_acknowledged_at?: string | null;
            })
          | null;
        setResponseId(typeof r?.id === "number" ? r.id : null);
        setCameraStoragePath(r?.camera_storage_path ?? null);
        setScreenStoragePath(r?.screen_storage_path ?? null);
        setCameraStatus(r?.camera_status ?? null);
        setScreenShareType(r?.screen_share_type ?? null);
        setProctoringInterrupted(Boolean(r?.proctoring_interrupted));
        setConsentAcknowledgedAt(r?.consent_acknowledged_at ?? null);

        if (responseRecord?.interview_id) {
          try {
            const interview = await InterviewService.getInterviewById(responseRecord.interview_id);
            if (isMounted) {
              setQuestionCount(
                typeof interview?.question_count === "number" ? interview.question_count : null,
              );
              // v3 rubric-aware: coverage_warnings is a JSONB array of strings.
              const cw = (interview as unknown as { coverage_warnings?: unknown })?.coverage_warnings;
              if (Array.isArray(cw)) {
                setCoverageWarnings(
                  cw.filter((s): s is string => typeof s === "string"),
                );
              } else {
                setCoverageWarnings([]);
              }
              setProctoringCameraEnabled(
                Boolean(
                  (interview as unknown as { proctoring_camera_enabled?: boolean })
                    ?.proctoring_camera_enabled,
                ),
              );
              setProctoringScreenEnabled(
                Boolean(
                  (interview as unknown as { proctoring_screen_enabled?: boolean })
                    ?.proctoring_screen_enabled,
                ),
              );
            }
          } catch {
            if (isMounted) {
              setQuestionCount(null);
              setCoverageWarnings([]);
              setProctoringCameraEnabled(false);
              setProctoringScreenEnabled(false);
            }
          }
        } else if (isMounted) {
          setQuestionCount(null);
          setCoverageWarnings([]);
          setProctoringCameraEnabled(false);
          setProctoringScreenEnabled(false);
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
    if (call && name) {
      setTranscript(formatCallTranscript(call.transcript, name));
    }
  }, [call, name]);

  const onDeleteResponseClick = async () => {
    try {
      const response = await ResponseService.getResponseByCallId(call_id);

      if (response) {
        const currentInterviewId = response.interview_id;
        await ResponseService.deleteResponse(call_id);
        router.push(`/jobs/${currentInterviewId}`);
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
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between w-full">
          <div className="space-y-4 w-full">
            <div className="flex justify-between">
              <div className="w-full">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-sm font-semibold text-[#203b14] transition-colors hover:border-[#c5ccb6] hover:bg-[#eef4e1]"
                  onClick={() => {
                    router.push(`/jobs/${interviewId}`);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to workspace
                </button>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={candidateStatus}
                  onValueChange={async (newValue: string) => {
                    setCandidateStatus(newValue);
                    await ResponseService.updateResponse({ candidate_status: newValue }, call_id);
                    onCandidateStatusChange(call_id, newValue);
                  }}
                >
                  <SelectTrigger className="w-[200px] rounded-full border-[#e0e5d5] bg-[#fbfdf6]">
                    <SelectValue placeholder="Candidate status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CandidateStatus.NO_STATUS}>No Status</SelectItem>
                    <SelectItem value={CandidateStatus.NOT_SELECTED}>Not Selected</SelectItem>
                    <SelectItem value={CandidateStatus.POTENTIAL}>Potential</SelectItem>
                    <SelectItem value={CandidateStatus.SELECTED}>Selected</SelectItem>
                  </SelectContent>
                </Select>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={isReanalyzing || isClicked}
                      className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-5 text-[#203b14] hover:border-[#c5ccb6] hover:bg-[#eef4e1] disabled:opacity-60"
                      variant="ghost"
                      title="Re-run the hiring-grade analysis on this session"
                      aria-label="Re-analyze session"
                    >
                      <RefreshCw
                        className={`h-4 w-4 ${isReanalyzing ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Re-analyze this session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This re-runs the hiring-grade scoring against the
                        stored transcript and Retell signals. The current
                        analytics will be overwritten. Use this after editing
                        the interview&apos;s job description, seniority, or
                        must-haves — or if the model output looks wrong.
                      </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>

                      <AlertDialogAction
                        className="bg-[#203b14] text-[#fbfdf6] hover:bg-[#152808]"
                        onClick={onReanalyzeClick}
                        disabled={isReanalyzing}
                      >
                        {isReanalyzing ? "Re-analyzing…" : "Re-analyze"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={isClicked}
                      className="rounded-full border border-[#d7bdb7] bg-[#f6ebe7] px-5 text-[#6b3f31] hover:bg-[#f0dfd8]"
                      variant="ghost"
                      title="Delete this response"
                      aria-label="Delete response"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>

                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this response?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The candidate session and its recruiter review
                        surface will be removed.
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

            <div className="flex flex-wrap items-start gap-4">
              <div>
                {name ? (
                  <p className="text-2xl font-semibold tracking-[-0.04em]">{name}</p>
                ) : (
                  <p className="text-2xl font-semibold tracking-[-0.04em]">Anonymous candidate</p>
                )}
                {email ? <p className="mt-1 text-sm text-[#53614d]">{email}</p> : null}
              </div>
            </div>
            <div className="flex justify-between w-full">
              <div className="flex flex-wrap items-center gap-2">
                <SessionCoverageRow
                  status={responseStatus}
                  questionsCovered={questionsCovered}
                  questionCount={questionCount}
                  disconnectionReason={disconnectionReason}
                />

                {coverageWarnings.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCoverageWarningsExpanded((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 text-amber-800 text-xs px-2 py-1 font-medium hover:bg-amber-200"
                    title="The operator saved this interview with acknowledged coverage gaps. Click to view."
                    aria-expanded={coverageWarningsExpanded}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Coverage warnings ({coverageWarnings.length})
                  </button>
                ) : null}
              </div>

              {tabSwitchCount && tabSwitchCount > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d7bdb7] bg-[#f6ebe7] px-4 py-2 text-sm font-semibold text-[#6b3f31]">
                  <AlertTriangle className="h-4 w-4" />
                  Tab switching detected
                </div>
              ) : null}
            </div>

            {coverageWarningsExpanded && coverageWarnings.length > 0 ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold mb-1">Acknowledged coverage gaps from this interview:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {coverageWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Hiring-grade analytics view (full-width).
          See openspec change `hiring-grade-analytics-scoring`. */}
      {isAnalyticsV2(analytics) ? (
        <AnalyticsV2View analytics={analytics} />
      ) : analytics ? (
        // Orphan pre-v2 row in the DB. Render an explicit placeholder rather
        // than silently showing nothing.
        <div className="rounded-2xl border border-stone-300 bg-stone-50 px-6 py-5 text-sm text-[#53614d]">
          <p className="font-semibold text-[#0a1d08]">Legacy analytics</p>
          <p className="mt-1">
            This response was scored with an older analytics pipeline and can&apos;t be displayed
            here. Re-trigger analysis to view the hiring-grade breakdown.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* session integrity card below */}

        <DetailCard title="Session integrity">
          <div className="space-y-4 text-sm leading-6 text-[#53614d]">
            <div>
              <p className="font-semibold text-[#0a1d08]">Sentiment</p>
              <DetailTextValue
                className="mt-1"
                value={call?.call_analysis?.user_sentiment}
                fallback={<Skeleton className="h-5 w-[160px]" />}
              />
            </div>
            <div>
              <p className="font-semibold text-[#0a1d08]">Call summary</p>
              <DetailTextValue
                className="mt-1"
                value={call?.call_analysis?.call_summary}
                fallback={<Skeleton className="h-5 w-[220px]" />}
              />
            </div>
          </div>
        </DetailCard>
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
              <p className="text-sm text-[#53614d]">No recording is available for this response.</p>
            )}
          </div>
        </DetailCard>
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


      {(proctoringCameraEnabled || proctoringScreenEnabled) &&
      responseId !== null ? (
        <ProctoringReview
          responseId={responseId}
          cameraEnabled={proctoringCameraEnabled}
          screenEnabled={proctoringScreenEnabled}
          cameraStoragePath={cameraStoragePath}
          screenStoragePath={screenStoragePath}
          cameraStatus={cameraStatus}
          screenShareType={screenShareType}
          proctoringInterrupted={proctoringInterrupted}
          consentAcknowledgedAt={consentAcknowledgedAt}
          audioUrl={call?.recording_url ?? null}
        />
      ) : null}
    </div>
  );
}

export default CallInfo;
