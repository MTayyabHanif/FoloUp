"use client";

import {
  AlertCircle,
  CheckCircle2,
  CheckCircleIcon,
  Clock3,
  Headphones,
  HelpCircle,
  Loader2,
  Mic,
  PhoneOff,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Volume2,
  WifiOff,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import { RetellWebClient } from "retell-client-js-sdk";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useResponses } from "@/contexts/responses.context";
import { cn, testEmail } from "@/lib/utils";
import { FeedbackService } from "@/services/feedback.service";
import { InterviewerService } from "@/services/interviewers.service";
import { ResponseService } from "@/services/responses.service";
import { Interview } from "@/types/interview";
import { FeedbackData } from "@/types/response";
import { FeedbackForm } from "@/components/call/feedbackForm";
import {
  TabSwitchWarning,
  useTabSwitchPrevention,
} from "./tabSwitchPrevention";

const webClient = new RetellWebClient();

type InterviewProps = {
  interview: Interview;
  sessionToken?: string;
};

type RegisterCallResponse = {
  data: {
    registerCallResponse: {
      call_id: string;
      access_token: string;
    };
    session_token?: string;
  };
};

type CheckSessionResponse = {
  exists: boolean;
  withinWindow: boolean;
  status: "ongoing" | "completed" | "interrupted" | "abandoned" | null;
  callId: string | null;
  responseId: number | null;
  name: string | null;
};

type ReconnectPhase =
  | "idle"
  | "checking"
  | "ready_to_resume"
  | "reconnecting"
  | "starting"
  | "expired"
  | "not_found"
  | "offline"
  | "check_failed"
  | "register_failed";

type Transcript = {
  role: string;
  content: string;
};

type InterviewerProfile = {
  image: string;
  name: string;
  description: string;
} | null;

function formatDurationLabel(minutes: string) {
  const parsed = Number(minutes);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "Guided session";
  }

  return `${parsed} minute${parsed === 1 ? "" : "s"}`;
}

function formatRemainingTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")} remaining`;
}

function CandidateFrame({
  children,
  title,
  subtitle,
  progressPercent,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  progressPercent?: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-[#c5ccb6] bg-[#fbfdf6]/96 text-[#0a1d08] shadow-[rgba(99,143,61,0.1)_0px_0px_0px_1px]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-[-6rem] top-[-7rem] h-56 w-56 rounded-full bg-[#d7e8b5]/45 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-[-5rem] h-64 w-64 rounded-full bg-[#e0e5d5]/75 blur-3xl" />
      </div>

      {typeof progressPercent === "number" ? (
        <div className="relative h-1.5 w-full bg-[#e0e5d5]">
          <div
            className="h-full bg-[#203b14] transition-all duration-500 ease-out"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      ) : null}

      <div className="relative border-b border-[#e0e5d5] px-6 py-6 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-white/75 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#203b14]">
              <Sparkles className="h-3.5 w-3.5" />
              Candidate interview
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] md:text-[2.8rem] md:leading-[1.05]">
                {title}
              </h1>
              <p className=" text-sm leading-6 text-[#31200b]/76 md:text-base">
                {subtitle}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">{children}</div>
    </div>
  );
}

function MetaPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-[#e0e5d5] bg-white/80 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d7e8b5]/45 text-[#203b14]">
          {icon}
        </div>
        <div>
          <p className="text-[12px] uppercase tracking-[0.16em] text-[#203b14]">
            {label}
          </p>
          <p className="text-sm font-medium text-[#0a1d08]">{value}</p>
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  title,
  children,
  icon,
  tone = "default",
}: {
  title: string;
  children: ReactNode;
  icon: ReactNode;
  tone?: "default" | "soft" | "warning";
}) {
  const toneClasses =
    tone === "warning"
      ? "border-[#c5ccb6] bg-[#f6f8ef]"
      : tone === "soft"
        ? "border-[#d7e8b5] bg-[#f7faef]"
        : "border-[#e0e5d5] bg-white/80";

  return (
    <div className={cn("rounded-[24px] border p-5", toneClasses)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#fbfdf6] text-[#203b14]">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium uppercase tracking-[0.16em] text-[#203b14]">
            {title}
          </h3>
          <div className="text-sm leading-6 text-[#31200b]/78">{children}</div>
        </div>
      </div>
    </div>
  );
}

function StatusPanel({
  title,
  body,
  icon,
  actions,
}: {
  title: string;
  body: string;
  icon: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 px-6 py-10 text-center md:px-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#d7e8b5]/45 text-[#203b14]">
        {icon}
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
          {title}
        </h2>
        <p className="text-sm leading-7 text-[#31200b]/78 md:text-base">
          {body}
        </p>
      </div>
      {actions ? <div className="flex w-full justify-center">{actions}</div> : null}
    </div>
  );
}

function ReconnectPanel({
  phase,
  name,
  onResume,
  onRetryCheck,
  onCloseTab,
  onReturnHome,
}: {
  phase: ReconnectPhase;
  name: string;
  onResume: () => void;
  onRetryCheck: () => void;
  onCloseTab: () => void;
  onReturnHome: () => void;
}) {
  const resumeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (phase === "ready_to_resume") {
      resumeButtonRef.current?.focus();
    }
  }, [phase]);

  if (phase === "checking" || phase === "reconnecting" || phase === "starting") {
    const labels: Record<ReconnectPhase, string> = {
      idle: "",
      checking: "Checking whether your session is still ready to resume.",
      ready_to_resume: "",
      reconnecting: "Reconnecting you to the active interview session.",
      starting: "Starting the interview again with your saved progress.",
      expired: "",
      not_found: "",
      offline: "",
      check_failed: "",
      register_failed: "",
    };

    return (
      <div className="px-6 py-10 md:px-8">
        <StatusPanel
          title="Preparing your session"
          body={labels[phase]}
          icon={<Loader2 className="h-8 w-8 animate-spin" />}
        />
      </div>
    );
  }

  if (phase === "ready_to_resume") {
    const displayName = name?.trim() || "there";

    return (
      <div className="grid gap-6 px-6 py-8 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-10">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#203b14]">
            Resume available
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
            Welcome back, {displayName}
          </h2>
          <p className="text-sm leading-7 text-[#31200b]/78 md:text-base">
            Your earlier interview session is still within the reconnect
            window. Resume now to continue from the same response record.
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              ref={resumeButtonRef}
              className="h-12 rounded-full bg-[#4a3212] px-6 text-base font-medium text-[#fbfdf6] hover:bg-[#31200b]"
              onClick={onResume}
            >
              Resume interview
            </Button>
            <Button
              variant="outline"
              className="h-12 rounded-full border-[#e0e5d5] bg-[#fbfdf6] px-6 text-[#0a1d08] hover:border-[#203b14] hover:text-[#203b14]"
              onClick={onCloseTab}
            >
              Start over from this page
            </Button>
          </div>
        </div>

        <div className="space-y-4 rounded-[28px] border border-[#e0e5d5] bg-white/80 p-6">
          <NoteCard
            title="What happens next"
            icon={<RefreshCcw className="h-5 w-5" />}
            tone="soft"
          >
            Resuming keeps your existing response row, refreshes the session
            heartbeat, and starts a new call token without losing the current
            interview lifecycle.
          </NoteCard>
          <NoteCard
            title="Before you continue"
            icon={<Headphones className="h-5 w-5" />}
          >
            Use the same tab, reconnect your microphone if needed, and keep a
            quiet environment so the session remains stable.
          </NoteCard>
        </div>
      </div>
    );
  }

  if (phase === "expired") {
    return (
      <div className="px-6 py-10 md:px-8">
        <StatusPanel
          title="This resume window has closed"
          body="Your earlier progress was saved, but the reconnect window has expired. Please contact the recruiter if you need a new session link."
          icon={<Clock3 className="h-9 w-9" />}
          actions={
            <Button
              variant="outline"
              className="h-12 rounded-full border-[#e0e5d5] bg-[#fbfdf6] px-6 text-[#0a1d08] hover:border-[#203b14] hover:text-[#203b14]"
              onClick={onCloseTab}
            >
              Return to interview page
            </Button>
          }
        />
      </div>
    );
  }

  if (phase === "not_found") {
    return (
      <div className="px-6 py-10 md:px-8">
        <StatusPanel
          title="We could not match this session token"
          body="This resume link no longer maps to an active interview session. Use the original invitation link if you want to begin again."
          icon={<HelpCircle className="h-9 w-9" />}
          actions={
            <Button
              variant="outline"
              className="h-12 rounded-full border-[#e0e5d5] bg-[#fbfdf6] px-6 text-[#0a1d08] hover:border-[#203b14] hover:text-[#203b14]"
              onClick={onReturnHome}
            >
              Go to interview page
            </Button>
          }
        />
      </div>
    );
  }

  if (phase === "offline") {
    return (
      <div className="px-6 py-10 md:px-8">
        <StatusPanel
          title="You appear to be offline"
          body="Reconnect to the internet and try the session check again. We only resume a call when the browser confirms the connection is live."
          icon={<WifiOff className="h-9 w-9" />}
          actions={
            <Button
              className="h-12 rounded-full bg-[#4a3212] px-6 text-[#fbfdf6] hover:bg-[#31200b]"
              onClick={onRetryCheck}
            >
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (phase === "check_failed") {
    return (
      <div className="px-6 py-10 md:px-8">
        <StatusPanel
          title="We could not verify the session"
          body="The resume check did not complete successfully. Refresh the page or retry the check from here."
          icon={<AlertCircle className="h-9 w-9" />}
          actions={
            <Button
              className="h-12 rounded-full bg-[#4a3212] px-6 text-[#fbfdf6] hover:bg-[#31200b]"
              onClick={onRetryCheck}
            >
              Retry session check
            </Button>
          }
        />
      </div>
    );
  }

  if (phase === "register_failed") {
    return (
      <div className="px-6 py-10 md:px-8">
        <StatusPanel
          title="We could not restart the interview call"
          body="Your saved response still exists, but a new call token could not be registered. Try once more or contact the recruiter if the issue continues."
          icon={<AlertCircle className="h-9 w-9" />}
          actions={
            <Button
              className="h-12 rounded-full bg-[#4a3212] px-6 text-[#fbfdf6] hover:bg-[#31200b]"
              onClick={onResume}
            >
              Try resume again
            </Button>
          }
        />
      </div>
    );
  }

  return null;
}

function PreflightView({
  interview,
  interviewerProfile,
  email,
  name,
  loading,
  isAnonymous,
  isValidEmail,
  micPermissionStatus,
  micPermissionError,
  onEmailChange,
  onNameChange,
  onStart,
  onExit,
}: {
  interview: Interview;
  interviewerProfile: InterviewerProfile;
  email: string;
  name: string;
  loading: boolean;
  isAnonymous: boolean;
  isValidEmail: boolean;
  micPermissionStatus: PermissionState | "unknown";
  micPermissionError: boolean;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onStart: () => void;
  onExit: () => Promise<void>;
}) {
  const canStart =
    (isAnonymous || (isValidEmail && Boolean(name.trim()))) && !loading;

  return (
    <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-10">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetaPill
              icon={<Clock3 className="h-4 w-4" />}
              label="Time reserved"
              value={formatDurationLabel(interview.time_duration)}
            />
            <MetaPill
              icon={<Mic className="h-4 w-4" />}
              label="Audio"
              value="Microphone required"
            />
          </div>
        </div>

        <div className="grid gap-4">
          <NoteCard
            title="What to expect"
            icon={<ShieldCheck className="h-5 w-5" />}
            tone="soft"
          >
            You will join a guided voice interview. Stay on this tab, keep your
            volume on, and answer naturally as questions arrive.
          </NoteCard>
          <NoteCard
            title="Environment check"
            icon={<Volume2 className="h-5 w-5" />}
          >
            Choose a quiet place, keep headphones nearby if possible, and make
            sure other browser audio apps are closed.
          </NoteCard>
        </div>

      </div>

      <form
        className="space-y-4 rounded-[30px] border-2 border-[#d7e8b5] bg-[#d7e8b5]/55 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void onStart();
        }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[#e0e5d5] bg-[#f6f8ef]">
            {interviewerProfile?.image ? (
              <Image
                src={interviewerProfile.image}
                alt={interviewerProfile.name || "Interviewer"}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-8 w-8 text-[#203b14]" />
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#203b14]">
              Interview guide
            </p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
              {interviewerProfile?.name || "Your interviewer"}
            </h2>
            {interviewerProfile?.description ? (
              <p className="text-sm leading-6 text-[#31200b]/72">
                {interviewerProfile.description}
              </p>
            ) : (
              <p className="text-sm leading-6 text-[#31200b]/72">
                A guided interviewer will walk you through the session and keep
                the pace steady from start to finish.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          {!isAnonymous ? (
            <div className="grid gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#203b14]">
                  Candidate details
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="candidate-full-name"
                  className="text-sm font-medium text-[#0a1d08]"
                >
                  Full name
                </label>
                <Input
                  id="candidate-full-name"
                  value={name}
                  type="text"
                  placeholder="Your full name"
                  className="h-12 rounded-[20px] border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] placeholder:text-[#31200b]/45 focus-visible:ring-[#203b14]/20"
                  onChange={(event) => onNameChange(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="candidate-email"
                  className="text-sm font-medium text-[#0a1d08]"
                >
                  Email address
                </label>
                <Input
                  id="candidate-email"
                  value={email}
                  type="email"
                  placeholder="name@example.com"
                  className="h-12 rounded-[20px] border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] placeholder:text-[#31200b]/45 focus-visible:ring-[#203b14]/20"
                  onChange={(event) => onEmailChange(event.target.value)}
                />
              </div>
            </div>
          ) : null}


          {micPermissionStatus === "denied" || micPermissionError ? (
            <div className="rounded-[22px] border border-[#c5ccb6] bg-[#f6f8ef] px-4 py-4 text-sm text-[#31200b]/80">
              <div className="flex items-center gap-2 font-medium text-[#203b14]">
                <AlertCircle className="h-4 w-4" />
                Microphone access is blocked
              </div>
              <p className="mt-2 leading-6">
                Allow microphone access in your browser settings, then press
                Start interview again from this page.
              </p>
            </div>
          ) : null}
        </div>

        <div className="pt-2 flex gap-4">
         

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-[40%] rounded-full text-[#31200b]/72 hover:bg-[#f6f8ef] hover:text-[#0a1d08]"
                disabled={loading}
              >
                Exit interview
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-[#c5ccb6] bg-[#fbfdf6] text-[#0a1d08]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-semibold tracking-[-0.04em]">
                  Leave before starting?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-6 text-[#31200b]/76">
                  You can close this page now if you are not ready to begin the
                  session.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full border-[#e0e5d5] bg-[#fbfdf6] text-[#0a1d08] hover:border-[#203b14] hover:text-[#203b14]">
                  Stay here
                </AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-full bg-[#4a3212] text-[#fbfdf6] hover:bg-[#31200b]"
                  onClick={onExit}
                >
                  Exit page
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

           <Button
            type="submit"
            className="h-12 w-full rounded-full bg-[#4a3212] text-base font-medium text-[#fbfdf6] hover:bg-[#31200b] disabled:opacity-55"
            disabled={!canStart}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Start interview"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function SpeakerPanel({
  title,
  transcript,
  avatar,
  active,
  subtitle,
}: {
  title: string;
  transcript: string;
  avatar: ReactNode;
  active: boolean;
  subtitle: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between rounded-[28px] border p-5 transition-colors",
        active
          ? "border-[#203b14] bg-[#f7faef]"
          : "border-[#e0e5d5] bg-white/80",
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-[#203b14]">
              {title}
            </p>
            <p className="text-xs text-[#31200b]/62">{subtitle}</p>
          </div>
          <div
            className={cn(
              "rounded-full px-3 py-1 text-[12px] uppercase tracking-[0.14em]",
              active
                ? "bg-[#203b14] text-[#fbfdf6]"
                : "border border-[#e0e5d5] bg-[#fbfdf6] text-[#31200b]/62",
            )}
          >
            {active ? "Speaking" : "Waiting"}
          </div>
        </div>
        <div className="min-h-[220px] rounded-[22px] border border-[#e0e5d5] bg-[#fbfdf6] px-5 py-4 text-[20px] leading-[1.45] text-[#0a1d08] md:text-[24px]">
          {transcript || "Waiting for the next response..."}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div
          className={cn(
            "flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border",
            active ? "border-[#203b14]" : "border-[#e0e5d5]",
          )}
        >
          {avatar}
        </div>
        <div>
          <p className="text-base font-medium text-[#0a1d08]">{title}</p>
          <p className="text-sm text-[#31200b]/62">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function ActiveSessionView({
  interviewerProfile,
  lastInterviewerResponse,
  lastUserResponse,
  activeTurn,
  timeRemainingLabel,
  progressPercent,
  onEnd,
  loading,
}: {
  interviewerProfile: InterviewerProfile;
  lastInterviewerResponse: string;
  lastUserResponse: string;
  activeTurn: string;
  timeRemainingLabel: string;
  progressPercent: number;
  onEnd: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <div className="space-y-6 px-6 py-8 md:px-8 md:py-10">
      <div className="grid gap-3 md:grid-cols-3">
        <MetaPill
          icon={<Clock3 className="h-4 w-4" />}
          label="Session timer"
          value={timeRemainingLabel}
        />
        <MetaPill
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Focus signal"
          value="Stay on this tab"
        />
        <MetaPill
          icon={<Headphones className="h-4 w-4" />}
          label="Interviewer"
          value={interviewerProfile?.name || "AI Bot"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SpeakerPanel
          title={interviewerProfile?.name || "AI Bot"}
          subtitle="Questioning and pacing"
          transcript={lastInterviewerResponse}
          active={activeTurn === "agent"}
          avatar={
            interviewerProfile?.image ? (
              <Image
                src={interviewerProfile.image}
                alt={interviewerProfile.name || "Interviewer"}
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-7 w-7 text-[#203b14]" />
            )
          }
        />
        <SpeakerPanel
          title="You"
          subtitle="Your latest response"
          transcript={lastUserResponse}
          active={activeTurn === "user"}
          avatar={
            <Image
              src="/user-icon.png"
              alt="Candidate"
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          }
        />
      </div>

      <div className="flex justify-center">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className="h-12 rounded-full border border-[#4a3212] bg-[#fbfdf6] px-6 text-[#4a3212] hover:bg-[#f6f8ef]"
              disabled={loading}
            >
              End interview
              <PhoneOff className="ml-2 h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="border-[#c5ccb6] bg-[#fbfdf6] text-[#0a1d08]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-semibold tracking-[-0.04em]">
                End this interview now?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-[#31200b]/76">
                This closes the active call and moves the session into its
                completion state.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-full border-[#e0e5d5] bg-[#fbfdf6] text-[#0a1d08] hover:border-[#203b14] hover:text-[#203b14]">
                Keep going
              </AlertDialogCancel>
              <AlertDialogAction
                className="rounded-full bg-[#4a3212] text-[#fbfdf6] hover:bg-[#31200b]"
                onClick={onEnd}
              >
                End interview
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function CompletionView({
  isStarted,
  isFeedbackSubmitted,
  isDialogOpen,
  onOpenChange,
  onFeedbackSubmit,
  email,
}: {
  isStarted: boolean;
  isFeedbackSubmitted: boolean;
  isDialogOpen: boolean;
  onOpenChange: (value: boolean) => void;
  onFeedbackSubmit: (data: Omit<FeedbackData, "interview_id">) => Promise<void>;
  email: string;
}) {
  return (
    <div className="px-6 py-10 md:px-8 md:py-12">
      <StatusPanel
        title={
          isStarted
            ? "Thank you for completing this interview"
            : "This interview session has been closed"
        }
        body={
          isStarted
            ? "Your responses have been recorded. You can close this tab whenever you are ready."
            : "No additional action is needed from you here. You can close this tab whenever you are ready."
        }
        icon={<CheckCircle2 className="h-9 w-9" />}
      />

      {!isFeedbackSubmitted ? (
        <div className="mt-4 flex justify-center">
          <AlertDialog open={isDialogOpen} onOpenChange={onOpenChange}>
            <AlertDialogTrigger asChild>
              <Button className="h-12 rounded-full bg-[#4a3212] px-6 text-[#fbfdf6] hover:bg-[#31200b]">
                Share feedback
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-[#c5ccb6] bg-[#fbfdf6] text-[#0a1d08]">
              <FeedbackForm email={email} onSubmit={onFeedbackSubmit} />
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}
    </div>
  );
}

function IneligibleView() {
  return (
    <div className="px-6 py-10 md:px-8 md:py-12">
      <StatusPanel
        title="This response cannot be started again"
        body="You have already completed this interview or this email address is not eligible for a fresh attempt. Please contact the recruiter if you expected a different result."
        icon={<CheckCircleIcon className="h-9 w-9" />}
      />
    </div>
  );
}

function Call({ interview, sessionToken }: InterviewProps) {
  const { createResponse } = useResponses();
  const router = useRouter();
  const pathname = usePathname();
  const { isDialogOpen: isTabWarningOpen, tabSwitchCount, handleUnderstand } =
    useTabSwitchPrevention();
  const [lastInterviewerResponse, setLastInterviewerResponse] =
    useState<string>("");
  const [lastUserResponse, setLastUserResponse] = useState<string>("");
  const [activeTurn, setActiveTurn] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isValidEmail, setIsValidEmail] = useState<boolean>(false);
  const [isOldUser, setIsOldUser] = useState<boolean>(false);
  const [callId, setCallId] = useState<string>("");
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [interviewerProfile, setInterviewerProfile] =
    useState<InterviewerProfile>(null);
  const [interviewTimeDuration, setInterviewTimeDuration] =
    useState<string>("1");
  const [time, setTime] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [micPermissionStatus, setMicPermissionStatus] = useState<
    PermissionState | "unknown"
  >("unknown");
  const [reconnectPhase, setReconnectPhase] = useState<ReconnectPhase>(
    sessionToken ? "checking" : "idle",
  );
  const [reconnectName, setReconnectName] = useState<string>("");
  const [priorCallId, setPriorCallId] = useState<string>("");
  const [activeSessionToken, setActiveSessionToken] = useState<string>("");

  const callIdRef = useRef<string>("");
  const tabSwitchCountRef = useRef<number>(0);
  const isCallingRef = useRef<boolean>(false);

  const totalDurationSeconds = Number(interviewTimeDuration || "0") * 60;
  const elapsedSeconds = Math.floor(time / 100);
  const progressPercent =
    totalDurationSeconds > 0
      ? (elapsedSeconds / totalDurationSeconds) * 100
      : 0;
  const remainingSeconds = Math.max(totalDurationSeconds - elapsedSeconds, 0);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  useEffect(() => {
    tabSwitchCountRef.current = tabSwitchCount;
  }, [tabSwitchCount]);

  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);

  const handleFeedbackSubmit = async (
    formData: Omit<FeedbackData, "interview_id">,
  ) => {
    try {
      const result = await FeedbackService.submitFeedback({
        ...formData,
        interview_id: interview.id,
      });

      if (result) {
        toast.success("Thank you for your feedback!");
        setIsFeedbackSubmitted(true);
        setIsDialogOpen(false);
      } else {
        toast.error("Failed to submit feedback. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("An error occurred. Please try again later.");
    }
  };

  useEffect(() => {
    if (isCalling) {
      const intervalId = window.setInterval(() => {
        setTime((previous) => previous + 1);
      }, 10);

      return () => window.clearInterval(intervalId);
    }

    return undefined;
  }, [isCalling]);

  useEffect(() => {
    if (totalDurationSeconds > 0 && elapsedSeconds >= totalDurationSeconds) {
      webClient.stopCall();
      setIsEnded(true);
    }
  }, [elapsedSeconds, totalDurationSeconds]);

  useEffect(() => {
    setIsValidEmail(testEmail(email));
  }, [email]);

  useEffect(() => {
    webClient.on("call_started", () => {
      setIsCalling(true);
    });

    webClient.on("call_ended", () => {
      setIsCalling(false);
      setIsEnded(true);
    });

    webClient.on("agent_start_talking", () => {
      setActiveTurn("agent");
    });

    webClient.on("agent_stop_talking", () => {
      setActiveTurn("user");
    });

    webClient.on("error", (error) => {
      console.error("An error occurred:", error);
      webClient.stopCall();
      setIsEnded(true);
      setIsCalling(false);
    });

    webClient.on("update", (update) => {
      if (update.transcript) {
        const transcripts: Transcript[] = update.transcript;
        const roleContents: Record<string, string> = {};

        transcripts.forEach((transcript) => {
          roleContents[transcript.role] = transcript.content;
        });

        setLastInterviewerResponse(roleContents.agent || "");
        setLastUserResponse(roleContents.user || "");
      }
    });

    return () => {
      webClient.removeAllListeners();
    };
  }, []);

  const onEndCallClick = async () => {
    if (isStarted) {
      setLoading(true);
      webClient.stopCall();
      setIsEnded(true);
      setLoading(false);

      return;
    }

    setIsEnded(true);
  };

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermissionError(false);
      setMicPermissionStatus("granted");

      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setMicPermissionError(true);
      setMicPermissionStatus("denied");

      return false;
    }
  };

  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          setMicPermissionStatus(permissionStatus.state);
          setMicPermissionError(permissionStatus.state === "denied");

          permissionStatus.onchange = () => {
            setMicPermissionStatus(permissionStatus.state);
            setMicPermissionError(permissionStatus.state === "denied");
          };
        })
        .catch(console.error);
    }
  }, []);

  const startConversation = async ({
    isReconnect = false,
  }: { isReconnect?: boolean } = {}) => {
    setMicPermissionError(false);

    if (
      !isReconnect &&
      !interview.is_anonymous &&
      (!isValidEmail || !name.trim())
    ) {
      return;
    }

    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) {
      setMicPermissionError(true);

      return;
    }

    const effectiveName = isReconnect ? reconnectName || "candidate" : name;
    const data = {
      mins: interview.time_duration,
      objective: interview.objective,
      questions: interview.questions.map((q) => q.question).join(", "),
      name: effectiveName || "not provided",
    };

    setLoading(true);
    if (isReconnect) {
      setReconnectPhase("reconnecting");
    }

    let oldUser = false;
    if (!isReconnect) {
      const oldUserEmails: string[] = (
        await ResponseService.getAllEmails(interview.id)
      ).map((item) => item.email);
      oldUser =
        oldUserEmails.includes(email) ||
        (interview.respondents && !interview.respondents.includes(email));
    }

    if (oldUser) {
      setIsOldUser(true);
      setLoading(false);

      return;
    }

    try {
      const registerCallResponse: RegisterCallResponse = await axios.post(
        "/api/register-call",
        { dynamic_data: data, interviewer_id: interview.interviewer_id },
      );
      const accessToken =
        registerCallResponse.data.registerCallResponse.access_token;
      const newCallId = registerCallResponse.data.registerCallResponse.call_id;
      const newSessionToken = registerCallResponse.data.session_token ?? "";

      if (!accessToken) {
        if (isReconnect) {
          setReconnectPhase("register_failed");
        }
        setLoading(false);

        return;
      }

      if (isReconnect) {
        setReconnectPhase("starting");
      }

      await webClient.startCall({ accessToken }).catch(console.error);
      setIsCalling(true);
      setIsStarted(true);
      setCallId(newCallId);
      setActiveSessionToken(newSessionToken);

      if (isReconnect) {
        if (priorCallId) {
          await ResponseService.updateResponse(
            {
              call_id: newCallId,
              last_active_at: new Date().toISOString(),
              session_token: newSessionToken,
            } as never,
            priorCallId,
          );
        }
        setReconnectPhase("idle");
      } else {
        await createResponse({
          interview_id: interview.id,
          call_id: newCallId,
          email,
          name,
          status: "ongoing",
          session_token: newSessionToken,
          last_active_at: new Date().toISOString(),
        } as never);
      }

      if (pathname && newSessionToken) {
        router.replace(`${pathname}?session=${newSessionToken}`);
      }
    } catch (error) {
      console.error("startConversation error", error);
      if (isReconnect) {
        setReconnectPhase("register_failed");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (interview.time_duration) {
      setInterviewTimeDuration(interview.time_duration);
    }
  }, [interview]);

  const runSessionCheck = useCallback(
    async (allowRetry: boolean) => {
      if (!sessionToken) {
        return;
      }

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setReconnectPhase("offline");

        return;
      }

      setReconnectPhase("checking");
      try {
        const response = await fetch(
          `/api/check-session?token=${encodeURIComponent(sessionToken)}`,
          { cache: "no-store" },
        );
        if (!response.ok) {
          throw new Error(`check-session ${response.status}`);
        }
        const body = (await response.json()) as CheckSessionResponse;

        if (!body.exists) {
          setReconnectPhase("not_found");

          return;
        }

        if (body.withinWindow && body.status === "ongoing") {
          setReconnectName(body.name ?? "");
          setName(body.name ?? "");
          setPriorCallId(body.callId ?? "");
          setActiveSessionToken(sessionToken);
          setReconnectPhase("ready_to_resume");

          return;
        }

        setReconnectPhase("expired");
      } catch (error) {
        console.error("check-session failed", error);
        if (allowRetry) {
          await runSessionCheck(false);

          return;
        }
        setReconnectPhase("check_failed");
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    if (sessionToken) {
      void runSessionCheck(true);
    }
  }, [sessionToken, runSessionCheck]);

  useEffect(() => {
    const fetchInterviewer = async () => {
      const interviewer = await InterviewerService.getInterviewer(
        interview.interviewer_id,
      );

      setInterviewerProfile(
        interviewer
          ? {
              image: interviewer.image,
              name: interviewer.name,
              description: interviewer.description,
            }
          : null,
      );
    };

    void fetchInterviewer();
  }, [interview.interviewer_id]);

  useEffect(() => {
    if (isEnded && callId) {
      const callIdSnapshot = callId;
      const tabCountSnapshot = tabSwitchCount;
      void fetch("/api/response-heartbeat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          call_id: callIdSnapshot,
          tab_switch_count: tabCountSnapshot,
        }),
        keepalive: true,
      }).catch(() => {});
    }

    if (isEnded && activeSessionToken && pathname) {
      router.replace(pathname);
    }
  }, [activeSessionToken, callId, isEnded, pathname, router, tabSwitchCount]);

  useEffect(() => {
    const flushHeartbeatBeacon = () => {
      const currentCallId = callIdRef.current;
      if (!currentCallId || !isCallingRef.current) {
        return;
      }

      const payload = JSON.stringify({
        call_id: currentCallId,
        tab_switch_count: tabSwitchCountRef.current,
      });

      try {
        const blob = new Blob([payload], { type: "application/json" });
        const sent = navigator.sendBeacon?.("/api/response-heartbeat", blob);
        if (!sent) {
          void fetch("/api/response-heartbeat", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Best effort only.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushHeartbeatBeacon();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flushHeartbeatBeacon);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flushHeartbeatBeacon);
    };
  }, []);

  return (
    <>
      <TabSwitchWarning
        count={tabSwitchCount}
        open={isStarted && isTabWarningOpen}
        onUnderstand={handleUnderstand}
      />

      <CandidateFrame
        title={interview.name}
        subtitle={interview.description}
        progressPercent={isStarted && !isEnded ? progressPercent : undefined}
      >
        {reconnectPhase !== "idle" && !isStarted && !isEnded ? (
          <ReconnectPanel
            phase={reconnectPhase}
            name={reconnectName}
            onResume={() => {
              void startConversation({ isReconnect: true });
            }}
            onRetryCheck={() => {
              void runSessionCheck(false);
            }}
            onCloseTab={() => {
              if (pathname) {
                router.replace(pathname);
              }
              setReconnectPhase("idle");
            }}
            onReturnHome={() => {
              if (pathname) {
                router.replace(pathname);
              }
              setReconnectPhase("idle");
            }}
          />
        ) : null}

        {reconnectPhase === "idle" && !isStarted && !isEnded && !isOldUser ? (
          <PreflightView
            interview={interview}
            interviewerProfile={interviewerProfile}
            email={email}
            name={name}
            loading={loading}
            isAnonymous={interview.is_anonymous}
            isValidEmail={isValidEmail}
            micPermissionStatus={micPermissionStatus}
            micPermissionError={micPermissionError}
            onEmailChange={setEmail}
            onNameChange={setName}
            onStart={() => {
              void startConversation();
            }}
            onExit={onEndCallClick}
          />
        ) : null}

        {isStarted && !isEnded && !isOldUser ? (
          <ActiveSessionView
            activeTurn={activeTurn}
            interviewerProfile={interviewerProfile}
            lastInterviewerResponse={lastInterviewerResponse}
            lastUserResponse={lastUserResponse}
            loading={loading}
            progressPercent={progressPercent}
            timeRemainingLabel={formatRemainingTime(remainingSeconds)}
            onEnd={onEndCallClick}
          />
        ) : null}

        {isEnded && !isOldUser ? (
          <CompletionView
            email={email}
            isStarted={isStarted}
            isDialogOpen={isDialogOpen}
            isFeedbackSubmitted={isFeedbackSubmitted}
            onOpenChange={setIsDialogOpen}
            onFeedbackSubmit={handleFeedbackSubmit}
          />
        ) : null}

        {isOldUser ? <IneligibleView /> : null}
      </CandidateFrame>
    </>
  );
}

export default Call;
