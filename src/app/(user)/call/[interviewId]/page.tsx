"use client";

import { useEffect, useState, use, type ReactNode } from "react";
import Image from "next/image";
import { ArrowRight, Monitor, Sparkles } from "lucide-react";

import { useInterviews } from "@/contexts/interviews.context";
import Call from "@/components/call";
import {
  ExpiredLinkSurface,
  InviteInvalidSurface,
  InviteRequiredSurface,
  OwnerPreviewBanner,
} from "@/components/call/accessSurfaces";
import { Interview } from "@/types/interview";
import type { AccessMode, ValidateAccessResponse } from "@/types/invite";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";

interface Props {
  params: Promise<{
    interviewId: string;
  }>;
  searchParams: Promise<{
    call?: string;
    edit?: boolean;
    session?: string;
    token?: string;
  }>;
}

function CandidateCanvas({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-[#fbfdf6] px-4 py-8 md:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-7rem] h-64 w-64 rounded-full bg-[#d7e8b5]/55 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-80 w-80 rounded-full bg-[#e0e5d5]/80 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#d7e8b5]/30 to-transparent" />
      </div>
      <div className="relative w-full max-w-6xl">{children}</div>
    </div>
  );
}

function StatusSurface({
  title,
  description,
  detail,
  image,
  icon,
}: {
  title: string;
  description: string;
  detail?: string;
  image?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-[#c5ccb6] bg-[#fbfdf6]/95 shadow-[rgba(99,143,61,0.1)_0px_0px_0px_1px]">
      <div className="grid gap-10 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#203b14]">
            <Sparkles className="h-3.5 w-3.5" />
            Candidate session
          </div>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-[#0a1d08] md:text-[3.3rem] md:leading-[1.05]">
              {title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[#31200b]/78 md:text-lg">
              {description}
            </p>
          </div>
          {detail && (<div className="rounded-[24px] border border-[#e0e5d5] bg-[#f6f8ef] p-5 text-sm leading-6 text-[#31200b]/82">
            {detail}
          </div>)}
        </div>

        <div className="flex items-center justify-center">
          <div className="flex min-h-[280px] w-full max-w-sm flex-col items-center justify-center rounded-[28px] border border-[#e0e5d5] bg-white/70 p-8 text-center">
            {image ? (
              <Image
                src={image}
                alt=""
                width={188}
                height={188}
                className="mb-6 h-auto w-40 object-contain"
              />
            ) : (
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#d7e8b5]/45 text-[#203b14]">
                {icon}
              </div>
            )}
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#203b14]">
              Guided experience
            </p>
            <p className="mt-3 text-sm leading-6 text-[#31200b]/72">
              The candidate flow stays focused on clarity, readiness, and a
              calm next step.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingSurface() {
  return (
    <div className="overflow-hidden rounded-[32px] border border-[#c5ccb6] bg-[#fbfdf6]/95 shadow-[rgba(99,143,61,0.1)_0px_0px_0px_1px]">
      <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-white/70 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#203b14]">
          <Sparkles className="h-3.5 w-3.5" />
          Preparing your interview
        </div>
        <LoaderWithText />
      </div>
    </div>
  );
}

function MobileFallback({ interviewName }: { interviewName?: string }) {
  return (
    <CandidateCanvas>
      <div className="mx-auto w-full max-w-xl overflow-hidden rounded-[32px] border border-[#c5ccb6] bg-[#fbfdf6]/95 shadow-[rgba(99,143,61,0.1)_0px_0px_0px_1px]">
        <div className="space-y-6 px-6 py-8 text-center md:px-10 md:py-10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#d7e8b5]/45 text-[#203b14]">
            <Monitor className="h-9 w-9" />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#203b14]">
              Desktop required
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
              Use a laptop or desktop to continue
            </h1>
            <p className="mx-auto max-w-lg text-base leading-7 text-[#31200b]/78">
              This interview session needs a larger screen and reliable browser
              audio controls. Please reopen the link from a desktop browser.
            </p>
          </div>

          <div className="rounded-[24px] border border-[#e0e5d5] bg-white/70 p-5 text-left">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#203b14]">
              Next step
            </p>
            <p className="mt-3 text-sm leading-6 text-[#31200b]/78">
              Send this link to your desktop browser and return when your
              microphone is ready.
            </p>
            {interviewName ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-sm text-[#0a1d08]">
                <ArrowRight className="h-4 w-4 text-[#203b14]" />
                {interviewName}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </CandidateCanvas>
  );
}

function InterviewInterface({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: Props) {
  const params = use(paramsPromise);
  const searchParams = use(searchParamsPromise);
  const sessionToken = searchParams.session;
  const inviteToken = searchParams.token;
  const [interview, setInterview] = useState<Interview>();
  const [isActive, setIsActive] = useState(true);
  const { getInterviewById } = useInterviews();
  const [interviewNotFound, setInterviewNotFound] = useState(false);
  const [access, setAccess] = useState<ValidateAccessResponse | null>(null);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessError, setAccessError] = useState(false);

  useEffect(() => {
    if (interview) {
      setIsActive(interview.is_active === true);
    }
  }, [interview, params.interviewId]);

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await getInterviewById(params.interviewId);
        if (response) {
          setInterview(response);
          document.title = response.name;
        } else {
          setInterviewNotFound(true);
        }
      } catch (error) {
        console.error(error);
        setInterviewNotFound(true);
      }
    };

    fetchInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.interviewId]);

  useEffect(() => {
    if (!interview || !interview.is_active) {
      return;
    }

    // Reconnect path: when ?session= is present, the candidate is resuming
    // a previously-authorized session. /api/check-session is the authority
    // for whether that token is still valid; the access gate would be a
    // false negative because the URL may have lost ?token= during the
    // initial register-call redirect. Skip validate-access and let <Call>
    // render — its reconnect logic handles it from here.
    if (sessionToken) {
      setAccess({ state: "valid", access_mode: "public" });
      setAccessChecking(false);

      return;
    }

    let cancelled = false;
    setAccessChecking(true);
    setAccessError(false);

    void (async () => {
      try {
        const res = await fetch("/api/validate-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interviewId: interview.id,
            token: inviteToken,
          }),
        });
        if (!res.ok) {
          if (!cancelled) {
            setAccessError(true);
          }

          return;
        }
        const data = (await res.json()) as ValidateAccessResponse;
        if (!cancelled) {
          setAccess(data);
        }
      } catch (err) {
        console.error("validate-access failed", err);
        if (!cancelled) {
          setAccessError(true);
        }
      } finally {
        if (!cancelled) {
          setAccessChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [interview, inviteToken, sessionToken]);

  let desktopContent: ReactNode;
  if (!interview) {
    desktopContent = interviewNotFound ? (
      <StatusSurface
        title="This interview link could not be verified"
        description="The session link does not match an available interview. Please return to the original invitation or contact the person who shared it with you."
        image="/invalid-url.png"
      />
    ) : (
      <LoadingSurface />
    );
  } else if (!isActive) {
    desktopContent = (
      <StatusSurface
        title="This interview is no longer accepting responses"
        description="The recruiter has closed this interview, so new candidate sessions cannot begin from this link right now."
        detail="If you expected to continue an active session, contact the recruiter and ask them to confirm whether the interview window has been reopened for you."
        image="/closed.png"
      />
    );
  } else if (accessChecking || accessError) {
    desktopContent = <LoadingSurface />;
  } else if (access && access.state === "expired-public") {
    desktopContent = <ExpiredLinkSurface />;
  } else if (access && access.state === "invite-required") {
    desktopContent = <InviteRequiredSurface />;
  } else if (
    access &&
    (access.state === "invite-invalid" ||
      access.state === "invite-expired" ||
      access.state === "invite-already-used")
  ) {
    desktopContent = <InviteInvalidSurface />;
  } else if (access && access.state === "valid") {
    const accessMode: AccessMode = access.access_mode ?? "public";
    desktopContent = (
      <>
        {accessMode === "owner_bypass" ? <OwnerPreviewBanner /> : null}
        <Call
          interview={interview}
          sessionToken={sessionToken}
          inviteToken={inviteToken}
        />
      </>
    );
  } else {
    desktopContent = <LoadingSurface />;
  }

  return (
    <>
      <div className="hidden md:block">
        <CandidateCanvas>{desktopContent}</CandidateCanvas>
      </div>
      <div className="md:hidden">
        <MobileFallback interviewName={interview?.name} />
      </div>
    </>
  );
}

export default InterviewInterface;
