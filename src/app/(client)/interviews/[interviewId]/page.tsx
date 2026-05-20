"use client";

import React, { use, useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { getClientBaseUrl } from "@/lib/base-url";
import { useInterviews } from "@/contexts/interviews.context";
import { useInterviewers } from "@/contexts/interviewers.context";
import { ResponseService } from "@/services/responses.service";
import { ClientService } from "@/services/clients.service";
import { InterviewService } from "@/services/interviews.service";
import type { Interview } from "@/types/interview";
import type { Response } from "@/types/response";
import CallInfo from "@/components/call/callInfo";
import SummaryInfo from "@/components/dashboard/interview/summaryInfo";
import EditInterview from "@/components/dashboard/interview/editInterview";
import Modal from "@/components/dashboard/Modal";
import SharePopup from "@/components/dashboard/interview/sharePopup";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import { PageShell, PageHeader } from "@/components/ui/page-shell";
import {
  buildHiringWorkflowSummary,
  formatDurationLabel,
  type WorkflowCandidate,
  type WorkflowStage,
} from "@/lib/hiring-workflow";

import { HeaderActions } from "./_components/header-actions";
import { SessionsPanel } from "./_components/sessions-panel";

interface Props {
  params: Promise<{
    interviewId: string;
  }>;
  searchParams: Promise<{
    call?: string;
    edit?: boolean | string;
  }>;
}

const RECRUITER_MARKER_PALETTE = [
  "#203b14",
  "#4a3212",
  "#6d7d58",
  "#8b6d4d",
  "#9aa58b",
  "#b8b597",
  "#6b7b8c",
  "#8a7f96",
] as const;

function InterviewHome({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: Props) {
  const params = use(paramsPromise);
  const searchParams = use(searchParamsPromise);
  const { getInterviewById } = useInterviews();
  const { interviewers } = useInterviewers();
  const { organization } = useOrganization();
  const router = useRouter();

  const [interview, setInterview] = useState<Interview>();
  const [responses, setResponses] = useState<Response[]>([]);
  const [isSharePopupOpen, setIsSharePopupOpen] = useState(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [themeColor, setThemeColor] = useState<string>("#203b14");
  const [railFilter, setRailFilter] = useState<"all" | WorkflowStage>("all");

  const selectedCallId =
    typeof searchParams.call === "string" ? searchParams.call : "";
  const isEditMode =
    searchParams.edit === true || String(searchParams.edit) === "true";

  const interviewer =
    interviewers.find((item) => item.id === interview?.interviewer_id) ?? null;
  const workflow = interview
    ? buildHiringWorkflowSummary({
        interview,
        responses,
        interviewer,
      })
    : null;

  const seeInterviewPreviewPage = () => {
    if (!interview?.url) {
      return;
    }

    const url = interview.readable_slug
      ? `${getClientBaseUrl()}/call/${interview.readable_slug}`
      : interview.url.startsWith("http")
        ? interview.url
        : `https://${interview.url}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [interviewResponse, responsesResponse] = await Promise.all([
          getInterviewById(params.interviewId),
          ResponseService.getAllResponses(params.interviewId),
        ]);

        if (!isMounted) {
          return;
        }

        if (interviewResponse) {
          setInterview(interviewResponse);
          setIsActive(interviewResponse.is_active);
          setThemeColor(interviewResponse.theme_color ?? "#203b14");
        }
        setResponses(responsesResponse);
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [getInterviewById, params.interviewId]);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        if (!organization?.id) {
          return;
        }

        const data = await ClientService.getOrganizationById(organization.id);
        if (data?.plan) {
          setCurrentPlan(data.plan);
        }
      } catch (error) {
        console.error("Error fetching organization data:", error);
      }
    };

    fetchOrganizationData();
  }, [organization]);

  const handleDeleteResponse = (deletedCallId: string) => {
    setResponses((previousResponses) =>
      previousResponses.filter((response) => response.call_id !== deletedCallId),
    );

    if (selectedCallId === deletedCallId) {
      router.push(`/interviews/${params.interviewId}`);
    }
  };

  const handleSelectCandidate = async (candidate: WorkflowCandidate) => {
    router.push(`/interviews/${params.interviewId}?call=${candidate.callId}`);

    if (candidate.isViewed) {
      return;
    }

    try {
      await ResponseService.saveResponse(
        { is_viewed: true },
        candidate.callId,
      );
      setResponses((previousResponses) =>
        previousResponses.map((item) =>
          item.call_id === candidate.callId
            ? { ...item, is_viewed: true }
            : item,
        ),
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggle = async () => {
    try {
      const updatedIsActive = !isActive;
      setIsActive(updatedIsActive);

      await InterviewService.updateInterview(
        { is_active: updatedIsActive },
        params.interviewId,
      );

      setInterview((previous) =>
        previous ? { ...previous, is_active: updatedIsActive } : previous,
      );

      toast.success("Interview status updated", {
        description: `The interview is now ${
          updatedIsActive ? "active" : "inactive"
        }.`,
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error("Error", {
        description: "Failed to update the interview status.",
        duration: 3000,
      });
    }
  };

  const handleThemeColorChange = async (newColor: string) => {
    try {
      await InterviewService.updateInterview(
        { theme_color: newColor },
        params.interviewId,
      );

      setThemeColor(newColor);
      setInterview((previous) =>
        previous ? { ...previous, theme_color: newColor } : previous,
      );

      toast.success("Identity marker updated", {
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error("Error", {
        description: "Failed to update the identity marker.",
        duration: 3000,
      });
    }
  };

  const handleCandidateStatusChange = (callId: string, newStatus: string) => {
    setResponses((previousResponses) =>
      previousResponses.map((response) =>
        response.call_id === callId
          ? { ...response, candidate_status: newStatus }
          : response,
      ),
    );
  };

  const openSharePopup = () => {
    setIsSharePopupOpen(true);
  };

  const closeSharePopup = () => {
    setIsSharePopupOpen(false);
  };

  const handleColorChange = (hex: string) => {
    if (hex.toLowerCase() !== themeColor.toLowerCase()) {
      handleThemeColorChange(hex);
    }
    setShowColorPicker(false);
  };

  const closeColorPicker = () => setShowColorPicker(false);

  if (loading || !workflow) {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center py-24">
          <LoaderWithText />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-12">
      <PageHeader
        eyebrow="Job workspace"
        title={workflow.title}
        description={`${workflow.interviewer?.name ?? "AI interviewer"} · ${formatDurationLabel(workflow.durationMinutes)} · ${workflow.totalResponses} candidate${workflow.totalResponses === 1 ? "" : "s"}`}
        actions={
          <HeaderActions
            isActive={isActive}
            currentPlan={currentPlan}
            onShare={openSharePopup}
            onEdit={() =>
              router.push(`/interviews/${params.interviewId}?edit=true`)
            }
            onToggleActive={handleToggle}
            onPreview={seeInterviewPreviewPage}
            onOpenMarker={() => setShowColorPicker(true)}
            onManageInvites={() =>
              router.push(`/interviews/${params.interviewId}/invites`)
            }
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <SessionsPanel
            workflow={workflow}
            interviewId={params.interviewId}
            selectedCallId={selectedCallId}
            railFilter={railFilter}
            onRailFilterChange={setRailFilter}
            onSelectCandidate={handleSelectCandidate}
          />
        </aside>

        <main className="min-w-0">
          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
            {selectedCallId ? (
              <CallInfo
                call_id={selectedCallId}
                onDeleteResponse={handleDeleteResponse}
                onCandidateStatusChange={handleCandidateStatusChange}
              />
            ) : isEditMode ? (
              <EditInterview interview={interview} />
            ) : (
              <SummaryInfo
                workflow={workflow}
                onOpenCandidate={(callId) =>
                  router.push(`/interviews/${params.interviewId}?call=${callId}`)
                }
              />
            )}
          </div>
        </main>
      </div>

      <Modal
        open={showColorPicker}
        size="sm"
        closeOnOutsideClick={false}
        onClose={closeColorPicker}
      >
        <div className="w-full max-w-sm rounded-[28px] bg-[#fbfdf6] p-1 text-[#0a1d08]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
            Recruiter identity marker
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
            Keep the brand cue subtle
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#53614d]">
            This marker helps you recognize the workflow in recruiter surfaces only. It no longer changes the candidate experience.
          </p>
          <div
            role="radiogroup"
            aria-label="Theme color swatches"
            className="mt-5 grid grid-cols-4 gap-3"
          >
            {RECRUITER_MARKER_PALETTE.map((hex) => {
              const selected = themeColor.toLowerCase() === hex.toLowerCase();

              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Theme color ${hex}`}
                  className={`relative h-12 w-12 rounded-full border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#203b14] focus-visible:ring-offset-2 ${
                    selected
                      ? "border-[#203b14] ring-2 ring-[#203b14] ring-offset-2"
                      : "border-[#d8ddd0]"
                  }`}
                  style={{ backgroundColor: hex }}
                  onClick={() => handleColorChange(hex)}
                />
              );
            })}
          </div>
        </div>
      </Modal>

      {isSharePopupOpen && interview ? (
        <SharePopup
          open={isSharePopupOpen}
          shareContent={
            interview.readable_slug
              ? `${getClientBaseUrl()}/call/${interview.readable_slug}`
              : (interview.url as string)
          }
          interviewId={interview.id}
          publicToken={interview.public_token ?? null}
          publicTokenExpiresAt={interview.public_token_expires_at ?? null}
          onClose={closeSharePopup}
        />
      ) : null}
    </PageShell>
  );
}

export default InterviewHome;
