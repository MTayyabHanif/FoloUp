"use client";

import { useEffect, useState, use } from "react";
import Image from "next/image";
import { ArrowUpRightSquareIcon, Monitor } from "lucide-react";

import { useInterviews } from "@/contexts/interviews.context";
import Call from "@/components/call";
import { Interview } from "@/types/interview";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";

interface Props {
  params: Promise<{
    interviewId: string;
  }>;
  searchParams: Promise<{
    call: string;
    edit: boolean;
  }>;
}

/**
 * Brand attribution row shown beneath every candidate-flow card.
 */
function PoweredBy() {
  return (
    <a
      className="mt-4 inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-muted-foreground transition-opacity hover:opacity-80"
      href={process.env.NEXT_PUBLIC_MARKETING_URL || "https://folo-up.co/"}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>
        Powered by{" "}
        <span className="font-bold text-foreground">
          Folo<span className="text-brand-bold">Up</span>
        </span>
      </span>
      <ArrowUpRightSquareIcon className="h-4 w-4 text-brand-bold" />
    </a>
  );
}

/**
 * Centered focus shell for the candidate flow. Single column, max-w-3xl,
 * generous vertical rhythm. Replaces the old `absolute -translate-x-1/2`
 * centering trick with a real flex layout.
 */
function CandidateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-3xl">{children}</div>
      <PoweredBy />
    </div>
  );
}

/**
 * Branded status card — used for not-found / inactive / loading states.
 */
function StatusCard({
  title,
  description,
  image,
}: {
  title: string;
  description: string;
  image?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center shadow-[var(--ds-shadow-overlay)]">
      <div className="flex flex-col items-center gap-4">
        {image ? (
          <Image
            src={image}
            alt=""
            width={180}
            height={180}
            className="mb-2"
          />
        ) : null}
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="rounded-2xl border bg-card p-10 shadow-[var(--ds-shadow-overlay)]">
      <div className="flex h-[60vh] flex-col items-center justify-center">
        <LoaderWithText />
      </div>
    </div>
  );
}

/**
 * Mobile fallback (md:hidden). Candidates on phones can't use the WebRTC
 * Retell call reliably, so we ask them to switch to desktop.
 */
function MobileFallback({ interviewName }: { interviewName?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-[var(--ds-shadow-overlay)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-subtlest text-brand-bold">
          <Monitor className="h-7 w-7" />
        </div>
        {interviewName ? (
          <p className="mt-4 text-base font-semibold">{interviewName}</p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          Please use a desktop browser to complete this interview. Apologies
          for the inconvenience.
        </p>
      </div>
      <PoweredBy />
    </div>
  );
}

function InterviewInterface({ params: paramsPromise }: Props) {
  const params = use(paramsPromise);
  const [interview, setInterview] = useState<Interview>();
  const [isActive, setIsActive] = useState(true);
  const { getInterviewById } = useInterviews();
  const [interviewNotFound, setInterviewNotFound] = useState(false);

  useEffect(() => {
    if (interview) {
      setIsActive(interview?.is_active === true);
    }
  }, [interview, params.interviewId]);

  useEffect(() => {
    const fetchinterview = async () => {
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

    fetchinterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.interviewId]);

  let desktopContent: React.ReactNode;
  if (!interview) {
    desktopContent = interviewNotFound ? (
      <StatusCard
        title="Invalid interview link"
        description="The link you used doesn't match any interview. Please check the URL with the person who sent it to you."
        image="/invalid-url.png"
      />
    ) : (
      <LoadingCard />
    );
  } else if (!isActive) {
    desktopContent = (
      <StatusCard
        title="This interview is closed"
        description="We're not currently accepting responses. Please contact the person who shared this link for more information."
        image="/closed.png"
      />
    );
  } else {
    desktopContent = (
      <div className="rounded-2xl border bg-card shadow-[var(--ds-shadow-overlay)]">
        <Call interview={interview} />
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <CandidateShell>{desktopContent}</CandidateShell>
      </div>
      <div className="md:hidden">
        <MobileFallback interviewName={interview?.name} />
      </div>
    </>
  );
}

export default InterviewInterface;
