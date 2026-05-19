"use client";

import {
  ArrowUpRightSquareIcon,
  AlarmClockIcon,
  XCircleIcon,
  CheckCircleIcon,
  AlertCircle,
  Clock,
  HelpCircle,
  WifiOff,
} from "lucide-react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useResponses } from "@/contexts/responses.context";
import Image from "next/image";
import axios from "axios";
import { RetellWebClient } from "retell-client-js-sdk";
import MiniLoader from "../loaders/mini-loader/miniLoader";
import { toast } from "sonner";
import { isLightColor, testEmail } from "@/lib/utils";
import { ResponseService } from "@/services/responses.service";
import { Interview } from "@/types/interview";
import { FeedbackData } from "@/types/response";
import { FeedbackService } from "@/services/feedback.service";
import { FeedbackForm } from "@/components/call/feedbackForm";
import {
  TabSwitchWarning,
  useTabSwitchPrevention,
} from "./tabSwitchPrevention";
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
import { InterviewerService } from "@/services/interviewers.service";

const webClient = new RetellWebClient();

type InterviewProps = {
  interview: Interview;
  sessionToken?: string;
};

type registerCallResponseType = {
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

type transcriptType = {
  role: string;
  content: string;
};

/**
 * Renders the reconnect-flow UI: welcome-back banner, "Resume Interview"
 * confirmation, three loading micro-states, session-expired screen,
 * session-not-found screen, offline screen, and the two API-failure
 * retry screens. Each branch is screen-reader friendly (role="status"
 * for transient phases, role="alert" for terminal states).
 */
function ReconnectPanel({
  phase,
  name,
  themeColor,
  onResume,
  onRetryCheck,
  onCloseTab,
  onReturnHome,
}: {
  phase: ReconnectPhase;
  name: string;
  themeColor: string;
  onResume: () => void;
  onRetryCheck: () => void;
  onCloseTab: () => void;
  onReturnHome: () => void;
}) {
  const resumeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-focus the Resume button so keyboard-only users don't have to tab.
  useEffect(() => {
    if (phase === "ready_to_resume") {
      resumeBtnRef.current?.focus();
    }
  }, [phase]);

  if (phase === "checking") {
    return (
      <div
        className="px-8 pb-10 pt-4 flex flex-col items-center"
        role="status"
        aria-live="polite"
      >
        <MiniLoader />
        <p className="mt-4 text-sm text-gray-600 font-medium">
          Checking session…
        </p>
      </div>
    );
  }

  if (phase === "ready_to_resume") {
    const displayName = name?.trim() || "back";

    return (
      <div className="px-8 pb-8 pt-2" role="region" aria-label="Resume interview">
        <div className="flex flex-col items-center max-w-md mx-auto space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 w-full">
            <div className="flex gap-3">
              <CheckCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-900 space-y-1">
                <p className="font-medium">Welcome back, {displayName}</p>
                <p className="text-blue-800/90">
                  Your interview session is still active. Ready to pick up
                  where you left off?
                </p>
              </div>
            </div>
          </div>
          <Button
            ref={resumeBtnRef}
            className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-brand-bold/30 transition-all"
            style={{
              backgroundColor: themeColor,
              color: isLightColor(themeColor) ? "black" : "white",
            }}
            onClick={onResume}
          >
            Resume Interview
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "reconnecting") {
    return (
      <div
        className="px-8 pb-10 pt-4 flex flex-col items-center"
        role="status"
        aria-live="polite"
      >
        <MiniLoader />
        <p className="mt-4 text-sm text-gray-600 font-medium">Reconnecting…</p>
      </div>
    );
  }

  if (phase === "starting") {
    return (
      <div
        className="px-8 pb-10 pt-4 flex flex-col items-center"
        role="status"
        aria-live="polite"
      >
        <MiniLoader />
        <p className="mt-4 text-sm text-gray-600 font-medium">
          Starting interview…
        </p>
      </div>
    );
  }

  if (phase === "expired") {
    return (
      <div
        className="px-8 pb-8 pt-2"
        role="alert"
      >
        <div className="flex flex-col items-center max-w-md mx-auto space-y-4 text-center">
          <Clock className="w-10 h-10 text-amber-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">
            Session window closed
          </h1>
          <p className="text-sm text-gray-600">
            Your interview session timed out. Your progress up to that point
            has been saved. Please contact the recruiter to continue.
          </p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={onCloseTab}
          >
            Close
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "not_found") {
    return (
      <div className="px-8 pb-8 pt-2" role="alert">
        <div className="flex flex-col items-center max-w-md mx-auto space-y-4 text-center">
          <HelpCircle className="w-10 h-10 text-gray-400" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">
            Interview link not recognized
          </h1>
          <p className="text-sm text-gray-600">
            This link doesn&apos;t match an active interview session. Please
            use the original link from your invitation email.
          </p>
          <Button variant="outline" onClick={onReturnHome}>
            Go to interview page
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "offline") {
    return (
      <div className="px-8 pb-8 pt-2" role="alert">
        <div className="flex flex-col items-center max-w-md mx-auto space-y-4 text-center">
          <WifiOff className="w-10 h-10 text-red-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">
            You appear to be offline
          </h1>
          <p className="text-sm text-gray-600">
            Please check your connection and reload the page to continue your
            interview.
          </p>
          <Button onClick={onRetryCheck}>Try again</Button>
        </div>
      </div>
    );
  }

  if (phase === "check_failed") {
    return (
      <div className="px-8 pb-8 pt-2" role="alert">
        <div className="flex flex-col items-center max-w-md mx-auto space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">
            We couldn&apos;t verify your session
          </h1>
          <p className="text-sm text-gray-600">
            Please try refreshing, or use your original interview link.
          </p>
          <Button onClick={onRetryCheck}>Try again</Button>
        </div>
      </div>
    );
  }

  if (phase === "register_failed") {
    return (
      <div className="px-8 pb-8 pt-2" role="alert">
        <div className="flex flex-col items-center max-w-md mx-auto space-y-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-500" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">
            Reconnection failed
          </h1>
          <p className="text-sm text-gray-600">
            Your progress is saved — please try again or contact the
            recruiter.
          </p>
          <Button onClick={onResume}>Try again</Button>
        </div>
      </div>
    );
  }

  return null;
}

function Call({ interview, sessionToken }: InterviewProps) {
  const { createResponse } = useResponses();
  const router = useRouter();
  const pathname = usePathname();
  const [lastInterviewerResponse, setLastInterviewerResponse] =
    useState<string>("");
  const [lastUserResponse, setLastUserResponse] = useState<string>("");
  const [activeTurn, setActiveTurn] = useState<string>("");
  const [Loading, setLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isValidEmail, setIsValidEmail] = useState<boolean>(false);
  const [isOldUser, setIsOldUser] = useState<boolean>(false);
  const [callId, setCallId] = useState<string>("");
  const { tabSwitchCount } = useTabSwitchPrevention();
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [interviewerImg, setInterviewerImg] = useState("");
  const [interviewTimeDuration, setInterviewTimeDuration] =
    useState<string>("1");
  const [time, setTime] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState(false);
  const [currentTimeDuration, setCurrentTimeDuration] = useState<string>("0");

  // Reconnect flow state. `reconnectPhase` drives the welcome-back UI,
  // session-expired UI, session-not-found UI, and all three loading
  // micro-states. `reconnectName` is the candidate name pulled from the
  // response row so the welcome-back banner can show "Welcome back, Jane".
  // `priorCallId` is the old Retell call_id (from check-session) — needed
  // so updateResponse() can target the right row after we mint a new call.
  const [reconnectPhase, setReconnectPhase] = useState<ReconnectPhase>(
    sessionToken ? "checking" : "idle",
  );
  const [reconnectName, setReconnectName] = useState<string>("");
  const [priorCallId, setPriorCallId] = useState<string>("");
  const [activeSessionToken, setActiveSessionToken] = useState<string>("");
  // Ref mirrors of state used by visibility-change handlers — the handler
  // closure captures stale state otherwise.
  const callIdRef = useRef<string>("");
  const tabSwitchCountRef = useRef<number>(0);
  const isCallingRef = useRef<boolean>(false);

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);
  useEffect(() => {
    tabSwitchCountRef.current = tabSwitchCount;
  }, [tabSwitchCount]);
  useEffect(() => {
    isCallingRef.current = isCalling;
  }, [isCalling]);

  const lastUserResponseRef = useRef<HTMLDivElement | null>(null);

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
    if (lastUserResponseRef.current) {
      const { current } = lastUserResponseRef;
      current.scrollTop = current.scrollHeight;
    }
  }, [lastUserResponse]);

  useEffect(() => {
    let intervalId: any;
    if (isCalling) {
      // setting time from 0 to 1 every 10 milisecond using javascript setInterval method
      intervalId = setInterval(() => setTime(time + 1), 10);
    }
    setCurrentTimeDuration(String(Math.floor(time / 100)));
    if (Number(currentTimeDuration) == Number(interviewTimeDuration) * 60) {
      webClient.stopCall();
      setIsEnded(true);
    }

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalling, time, currentTimeDuration]);

  useEffect(() => {
    if (testEmail(email)) {
      setIsValidEmail(true);
    }
  }, [email]);

  useEffect(() => {
    webClient.on("call_started", () => {
      console.log("Call started");
      setIsCalling(true);
    });

    webClient.on("call_ended", () => {
      console.log("Call ended");
      setIsCalling(false);
      setIsEnded(true);
    });

    webClient.on("agent_start_talking", () => {
      setActiveTurn("agent");
    });

    webClient.on("agent_stop_talking", () => {
      // Optional: Add any logic when agent stops talking
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
        const transcripts: transcriptType[] = update.transcript;
        const roleContents: { [key: string]: string } = {};

        transcripts.forEach((transcript) => {
          roleContents[transcript?.role] = transcript?.content;
        });

        setLastInterviewerResponse(roleContents["agent"]);
        setLastUserResponse(roleContents["user"]);
      }
      //TODO: highlight the newly uttered word in the UI
    });

    return () => {
      // Clean up event listeners
      webClient.removeAllListeners();
    };
  }, []);

  const onEndCallClick = async () => {
    if (isStarted) {
      setLoading(true);
      webClient.stopCall();
      setIsEnded(true);
      setLoading(false);
    } else {
      setIsEnded(true);
    }
  };

  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the tracks to release the microphone since we just want to check permission
      stream.getTracks().forEach((track) => track.stop());
      
return true;
    } catch (err) {
      console.error("Microphone permission denied:", err);
      
return false;
    }
  };

  const [micPermissionStatus, setMicPermissionStatus] = useState<PermissionState | "unknown">("unknown");

  useEffect(() => {
    // Check permission on mount
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          setMicPermissionStatus(permissionStatus.state);
          // If already denied, show error immediately
          if (permissionStatus.state === "denied") {
            setMicPermissionError(true);
          } else {
             // If prompt or granted, clear error (we'll check again on click)
            setMicPermissionError(false);
          }

          permissionStatus.onchange = () => {
             setMicPermissionStatus(permissionStatus.state);
             if (permissionStatus.state === "denied") {
                setMicPermissionError(true);
             } else {
                setMicPermissionError(false);
             }
          };
        })
        .catch(console.error);
    }
  }, []);

  const startConversation = async ({
    isReconnect = false,
  }: { isReconnect?: boolean } = {}) => {
    // If specifically denied, don't even try to start (button should be disabled anyway)
    if (micPermissionError) {return;}

    setMicPermissionError(false);
    // basic validation — skipped on reconnect (we already have name/email
    // on the existing response row).
    if (!isReconnect && !interview?.is_anonymous && (!isValidEmail || !name)) {
      return;
    }

    // Check microphone permission first
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) {
      setMicPermissionError(true);
      
return;
    }

    const effectiveName = isReconnect ? reconnectName || "candidate" : name;
    const data = {
      mins: interview?.time_duration,
      objective: interview?.objective,
      questions: interview?.questions.map((q) => q.question).join(", "),
      name: effectiveName || "not provided",
    };
    setLoading(true);
    if (isReconnect) {setReconnectPhase("reconnecting");}

    // Skip the "already responded" check on a verified reconnect — the
    // candidate is resuming their own in-flight session, not starting a
    // fresh response.
    let OldUser = false;
    if (!isReconnect) {
      const oldUserEmails: string[] = (
        await ResponseService.getAllEmails(interview.id)
      ).map((item) => item.email);
      OldUser =
        oldUserEmails.includes(email) ||
        (interview?.respondents && !interview?.respondents.includes(email));
    }

    if (OldUser) {
      setIsOldUser(true);
      setLoading(false);
      
return;
    }

    try {
      const registerCallResponse: registerCallResponseType = await axios.post(
        "/api/register-call",
        { dynamic_data: data, interviewer_id: interview?.interviewer_id },
      );
      const accessToken =
        registerCallResponse.data.registerCallResponse.access_token;
      const newCallId =
        registerCallResponse.data.registerCallResponse.call_id;
      const newSessionToken =
        registerCallResponse.data.session_token ?? "";

      if (!accessToken) {
        console.log("Failed to register call");
        if (isReconnect) {setReconnectPhase("register_failed");}
        setLoading(false);
        
return;
      }

      if (isReconnect) {setReconnectPhase("starting");}

      await webClient.startCall({ accessToken }).catch(console.error);
      setIsCalling(true);
      setIsStarted(true);
      setCallId(newCallId);
      setActiveSessionToken(newSessionToken);

      if (isReconnect) {
        // Reuse the existing response row — repoint call_id to the new
        // Retell call and refresh last_active_at so the heartbeat /
        // webhook keep targeting the same lifecycle record.
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
        // Fresh response row. Insert with status, session_token, and
        // last_active_at populated so check-session.withinWindow can
        // resolve correctly on a subsequent reload.
        await createResponse({
          interview_id: interview.id,
          call_id: newCallId,
          email: email,
          name: name,
          status: "ongoing",
          session_token: newSessionToken,
          last_active_at: new Date().toISOString(),
        } as never);
      }

      // Append ?session=<token> to the URL without a reload so a
      // refresh/tab-close within the 60s window can reconnect.
      if (pathname && newSessionToken) {
        router.replace(`${pathname}?session=${newSessionToken}`);
      }
    } catch (err) {
      console.error("startConversation error", err);
      if (isReconnect) {setReconnectPhase("register_failed");}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (interview?.time_duration) {
      setInterviewTimeDuration(interview?.time_duration);
    }
  }, [interview]);

  /**
   * Reconnect bootstrap. If the page mounted with ?session=<token>:
   *   1. If the browser is offline → show offline screen.
   *   2. GET /api/check-session?token=... once (retry on first failure).
   *   3. If withinWindow && status=ongoing → enter ready_to_resume,
   *      pre-fill name, store priorCallId for later updateResponse.
   *   4. If exists=false → not_found.
   *   5. Otherwise → expired.
   */
  const runSessionCheck = useCallback(
    async (allowRetry: boolean) => {
      if (!sessionToken) {return;}

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setReconnectPhase("offline");

        return;
      }

      setReconnectPhase("checking");
      try {
        const res = await fetch(
          `/api/check-session?token=${encodeURIComponent(sessionToken)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          throw new Error(`check-session ${res.status}`);
        }
        const body = (await res.json()) as CheckSessionResponse;

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

        // Row exists but reconnect not allowed (out of window or already closed).
        setReconnectPhase("expired");
      } catch (err) {
        console.error("check-session failed", err);
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
      setInterviewerImg(interviewer.image);
    };
    fetchInterviewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.interviewer_id]);

  // Webhook owns end-state (status, is_ended, disconnection_reason). Client
  // only flushes the final tab_switch_count via the heartbeat endpoint and
  // strips the ?session= param from the URL so the completion screen
  // doesn't expose a stale token.
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
      }).catch(() => {
        // Heartbeat failure is non-blocking; webhook still records end-state.
      });
    }

    if (isEnded && activeSessionToken && pathname) {
      // Drop ?session=<token> from the URL so the completion / feedback
      // screen doesn't leak the token into address-bar history.
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnded]);

  // Tab-switch heartbeat: when the candidate switches away from the tab,
  // flush last_active_at and tab_switch_count via sendBeacon so the write
  // survives the page being backgrounded or torn down.
  useEffect(() => {
    const flushHeartbeatBeacon = () => {
      const id = callIdRef.current;
      if (!id || !isCallingRef.current) {return;}
      const payload = JSON.stringify({
        call_id: id,
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
        // Best-effort — failure is acceptable.
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
    <div className="flex justify-center items-center min-h-screen bg-gray-50/50">
      {isStarted && <TabSwitchWarning />}
      <div className="w-full max-w-3xl mx-auto p-4">
        <Card className="bg-white shadow-xl rounded-2xl border-0 overflow-hidden">
          <div>
            {!isEnded && (
               <div className="h-1.5 w-full bg-gray-100">
                <div
                  className="bg-brand-bold h-full transition-all duration-500 ease-in-out"
                  style={{
                    width: `${
                        (Number(currentTimeDuration) /
                          (Number(interviewTimeDuration) * 60)) *
                        100
                      }%`,
                  }}
                />
              </div>
            )}
            
            <CardHeader className="p-8 pb-0">
              {!isEnded && (
                <div className="flex flex-col gap-2 mb-6">
                   <div className="flex items-center justify-between">
                      <CardTitle className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                        {interview?.name}
                      </CardTitle>
                      
                       <div className="flex items-center text-sm font-medium px-3 py-1 rounded-full bg-brand-subtlest text-brand-bolder">
                        <AlarmClockIcon
                          className="w-4 h-4 mr-2"
                        />
                        <span>{interviewTimeDuration} mins</span>
                      </div>
                   </div>
                </div>
              )}
            </CardHeader>
            {reconnectPhase !== "idle" && !isStarted && !isEnded && (
              <ReconnectPanel
                phase={reconnectPhase}
                name={reconnectName}
                themeColor={interview.theme_color ?? "#4F46E5"}
                onResume={() => startConversation({ isReconnect: true })}
                onRetryCheck={() => runSessionCheck(false)}
                onCloseTab={() => {
                  if (pathname) {router.replace(pathname);}
                  setReconnectPhase("idle");
                }}
                onReturnHome={() => {
                  if (pathname) {router.replace(pathname);}
                  setReconnectPhase("idle");
                }}
              />
            )}
            {reconnectPhase === "idle" && !isStarted && !isEnded && !isOldUser && (
              <div className="px-8 pb-8 pt-2">
                <div className="flex flex-col items-center">
                  {interview?.logo_url && (
                    <div className="mb-6">
                      <Image
                        src={interview?.logo_url}
                        alt="Logo"
                        className="h-16 w-auto object-contain"
                        width={120}
                        height={120}
                      />
                    </div>
                  )}
                  
                  <div className="w-full max-w-md space-y-6">
                    <div className="text-center space-y-4">
                        <p className="text-gray-600 text-base leading-relaxed">
                          {interview?.description}
                        </p>

                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left">
                            <div className="flex gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    <AlertCircle className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="text-sm text-blue-900 space-y-1">
                                    <p className="font-medium">Before you start:</p>
                                    <ul className="list-disc pl-4 space-y-1 text-blue-800/90">
                                        <li>Ensure your volume is up</li>
                                        <li>Check that you are in a quiet environment</li>
                                        <li>Tab switching will be recorded</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {!interview?.is_anonymous && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">Email Address</label>
                          <input
                            value={email}
                            type="email"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-brand-bold/20 focus:border-brand-bold transition-all bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400"
                            placeholder="name@example.com"
                            onChange={(e) => setEmail(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">First Name</label>
                          <input
                            value={name}
                             type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-brand-bold/20 focus:border-brand-bold transition-all bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400"
                            placeholder="Your first name"
                            onChange={(e) => setName(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    <div className="pt-4 flex flex-col items-center gap-3">
                        {/* Step 1: Check Microphone (if not granted) */}
                        {(micPermissionStatus === "prompt" || micPermissionStatus === "unknown") && (
                           <Button
                            className="w-full h-12 rounded-xl text-base font-medium shadow-sm hover:shadow-md transition-all"
                            style={{
                              backgroundColor: "#F59E0B", // Amber-500
                              color: "white",
                            }}
                            onClick={checkMicrophonePermission}
                          >
                            <AlertCircle className="w-5 h-5 mr-2" />
                            Check Microphone Access
                          </Button>
                        )}

                        {/* Step 2: Start Interview (only if granted) */}
                        {micPermissionStatus === "granted" && (
                           <div className="w-full space-y-3">
                            <div className="bg-green-50 text-green-700 text-sm py-2 px-4 rounded-lg flex items-center justify-center font-medium border border-green-100">
                                <CheckCircleIcon className="w-4 h-4 mr-2" />
                                Microphone Connected
                            </div>
                            <Button
                              className="w-full h-12 rounded-xl text-base font-semibold shadow-lg shadow-brand-bold/30 hover:shadow-brand-bold/40 transition-all transform hover:-translate-y-0.5"
                              style={{
                                backgroundColor: interview.theme_color ?? "#4F46E5",
                                color: isLightColor(interview.theme_color ?? "#4F46E5")
                                  ? "black"
                                  : "white",
                              }}
                              disabled={
                                Loading ||
                                (!interview?.is_anonymous && (!isValidEmail || !name))
                              }
                              onClick={() => startConversation()}
                            >
                              {!Loading ? "Start Interview" : <MiniLoader />}
                            </Button>
                          </div>
                        )}

                        {/* Error State: Denied */}
                        {micPermissionStatus === "denied" && (
                          <div className="w-full bg-red-50 border border-red-100 rounded-xl p-4 text-center space-y-3">
                              <div className="flex flex-col items-center text-red-600 font-medium">
                                  <XCircleIcon className="w-8 h-8 mb-2 opacity-80" />
                                  <span>Microphone Access Blocked</span>
                              </div>
                            <p className="text-sm text-red-600/80">
                              Please allow microphone access in your browser settings (click the lock icon in the address bar).
                            </p>
                            <Button
                              variant="outline"
                              className="w-full border-red-200 text-red-700 hover:bg-red-100 hover:text-red-800"
                              onClick={checkMicrophonePermission}
                            >
                              Try Again
                            </Button>
                          </div>
                        )}
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="text-sm text-gray-400 hover:text-gray-600 font-medium py-2 transition-colors"
                        disabled={Loading}
                      >
                        Exit Interview
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to exit?</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-brand-bold hover:bg-brand-bolder"
                          onClick={async () => {
                            await onEndCallClick();
                          }}
                        >
                          Exit
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                </div>
              </div>
            </div>
            )}
            {isStarted && !isEnded && !isOldUser && (
              <div className="flex flex-row p-2 grow">
                <div className="border-x-2 border-grey w-[50%] my-auto min-h-[70%]">
                  <div className="flex flex-col justify-evenly">
                    <div
                      className={`text-[22px] w-[80%] md:text-[26px] mt-4 min-h-[250px] mx-auto px-6`}
                    >
                      {lastInterviewerResponse}
                    </div>
                    <div className="flex flex-col mx-auto justify-center items-center align-middle">
                      <Image
                        src={interviewerImg}
                        alt="Image of the interviewer"
                        width={120}
                        height={120}
                        className={`object-cover object-center mx-auto my-auto ${
                          activeTurn === "agent"
                            ? `border-4 border-[${interview.theme_color}] rounded-full`
                            : ""
                        }`}
                      />
                      <div className="font-semibold">Interviewer</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-evenly w-[50%]">
                  <div
                    ref={lastUserResponseRef}
                    className={`text-[22px] w-[80%] md:text-[26px] mt-4 mx-auto h-[250px] px-6 overflow-y-auto`}
                  >
                    {lastUserResponse}
                  </div>
                  <div className="flex flex-col mx-auto justify-center items-center align-middle">
                    <Image
                      src={`/user-icon.png`}
                      alt="Picture of the user"
                      width={120}
                      height={120}
                      className={`object-cover object-center mx-auto my-auto ${
                        activeTurn === "user"
                          ? `border-4 border-[${interview.theme_color}] rounded-full`
                          : ""
                      }`}
                    />
                    <div className="font-semibold">You</div>
                  </div>
                </div>
              </div>
            )}
            {isStarted && !isEnded && !isOldUser && (
              <div className="items-center p-2">
                <AlertDialog>
                  <AlertDialogTrigger className="w-full">
                    <Button
                      className=" bg-white text-black border  border-brand-bold h-10 mx-auto flex flex-row justify-center mb-8"
                      disabled={Loading}
                    >
                      End Interview{" "}
                      <XCircleIcon className="h-[1.5rem] ml-2 w-[1.5rem] rotate-0 scale-100  dark:-rotate-90 dark:scale-0 text-red" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This action will end the
                        call.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-brand-bold hover:bg-brand-bolder"
                        onClick={async () => {
                          await onEndCallClick();
                        }}
                      >
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {isEnded && !isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2  border border-brand-subtle rounded-md p-2 m-2 bg-slate-50  absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-brand-bold " />
                    <p className="text-lg font-semibold text-center">
                      {isStarted
                        ? `Thank you for taking the time to participate in this interview`
                        : "Thank you very much for considering."}
                    </p>
                    <p className="text-center">
                      {"\n"}
                      You can close this tab now.
                    </p>
                  </div>

                  {!isFeedbackSubmitted && (
                    <AlertDialog
                      open={isDialogOpen}
                      onOpenChange={setIsDialogOpen}
                    >
                      <AlertDialogTrigger className="w-full flex justify-center">
                        <Button
                          className="bg-brand-bold text-white h-10 mt-4 mb-4"
                          onClick={() => setIsDialogOpen(true)}
                        >
                          Provide Feedback
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <FeedbackForm
                          email={email}
                          onSubmit={handleFeedbackSubmit}
                        />
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )}
            {isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2  border border-brand-subtle rounded-md p-2 m-2 bg-slate-50  absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-brand-bold " />
                    <p className="text-lg font-semibold text-center">
                      You have already responded in this interview or you are
                      not eligible to respond. Thank you!
                    </p>
                    <p className="text-center">
                      {"\n"}
                      You can close this tab now.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
        <a
          className="flex flex-row justify-center align-middle mt-3"
          href={process.env.NEXT_PUBLIC_MARKETING_URL || "https://robustagency.co"}
          target="_blank"
        >
          <div className="text-center text-md font-semibold mr-2  ">
            Powered by{" "}
            <span className="font-bold">
              Robust <span className="text-brand-bold">Devs</span>
            </span>
          </div>
          <ArrowUpRightSquareIcon className="h-[1.5rem] w-[1.5rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-brand-bold " />
        </a>
      </div>
    </div>
  );
}

export default Call;
