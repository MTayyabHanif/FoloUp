"use client";

import React, { use, useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  Eye,
  Palette,
  Pencil,
  PlayCircle,
  Share2,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  PageShell,
  PageHeader,
  Section,
} from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildHiringWorkflowSummary,
  formatDurationLabel,
  formatResponseTime,
  getWorkflowToneClasses,
  type WorkflowStage,
} from "@/lib/hiring-workflow";

interface Props {
  params: Promise<{
    interviewId: string;
  }>;
  searchParams: Promise<{
    call?: string;
    edit?: boolean | string;
  }>;
}

const baseUrl = process.env.NEXT_PUBLIC_LIVE_URL;
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

function OverviewCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#0a1d08]">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#53614d]">{detail}</p>
    </div>
  );
}

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
    const protocol = baseUrl?.includes("localhost") ? "http" : "https";
    if (!interview?.url) {
      return;
    }

    const url = interview.readable_slug
      ? `${protocol}://${baseUrl}/call/${interview.readable_slug}`
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

  const handleResponseClick = async (response: Response) => {
    try {
      await ResponseService.saveResponse({ is_viewed: true }, response.call_id);
      setResponses((previousResponses) =>
        previousResponses.map((item) =>
          item.call_id === response.call_id ? { ...item, is_viewed: true } : item,
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

  const visibleGroups = workflow.stageGroups.filter((group) => {
    if (railFilter === "all") {
      return group.count > 0;
    }

    return group.key === railFilter && group.count > 0;
  });

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
        variant="ghost"
        onClick={openSharePopup}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
      <Button
        className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
        variant="ghost"
        onClick={seeInterviewPreviewPage}
      >
        <Eye className="mr-2 h-4 w-4" />
        Preview
      </Button>
      <Button
        className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
        variant="ghost"
        onClick={() => setShowColorPicker(!showColorPicker)}
      >
        <Palette className="mr-2 h-4 w-4" />
        Marker
      </Button>
      <Button
        className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
        variant="ghost"
        onClick={() => router.push(`/interviews/${params.interviewId}?edit=true`)}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>
      <div className="ml-2 flex items-center gap-3 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2">
        {currentPlan === "free_trial_over" ? (
          <span className="text-sm text-[#6f7866]">Inactive</span>
        ) : (
          <>
            <span className="text-sm text-[#53614d]">
              {isActive ? "Active" : "Inactive"}
            </span>
            <Switch checked={isActive} aria-label="Toggle interview active" onCheckedChange={handleToggle} />
          </>
        )}
      </div>
    </div>
  );

  return (
    <PageShell className="pb-12">
      <PageHeader
        eyebrow="Job workspace"
        title={workflow.title}
        description={`${workflow.interviewer?.name ?? "AI interviewer"} · ${formatDurationLabel(workflow.durationMinutes)} · ${workflow.totalResponses} candidate${workflow.totalResponses === 1 ? "" : "s"}`}
        actions={headerActions}
      />

      <div className="rounded-[28px] border border-[#e0e5d5] bg-[#f6f8ef] p-6 text-[#0a1d08]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2">
              <span
                className="inline-flex h-3 w-3 rounded-full border border-white/80"
                style={{ backgroundColor: themeColor }}
              />
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                  workflow.healthTone,
                )}`}
              >
                {workflow.healthLabel}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#53614d]">
              {workflow.objective}
            </p>
          </div>

          <div className="rounded-[22px] border border-[#e0e5d5] bg-[#fbfdf6] px-5 py-4 text-sm leading-6 text-[#53614d]">
            <div className="inline-flex items-center gap-2 text-[#0a1d08]">
              <UserRound className="h-4 w-4" />
              <span className="font-semibold">
                {workflow.interviewer?.name ?? "AI interviewer"}
              </span>
            </div>
            <p className="mt-3">
              {workflow.healthSummary}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            label="Live sessions"
            value={workflow.liveCount}
            detail="Candidates currently inside the interview."
          />
          <OverviewCard
            label="Needs review"
            value={workflow.reviewCount}
            detail="Finished sessions waiting for recruiter judgment."
          />
          <OverviewCard
            label="Shortlist"
            value={workflow.shortlistedCount}
            detail="Potential and selected candidates in this job."
          />
          <OverviewCard
            label="Analysis pending"
            value={workflow.analysisPendingCount}
            detail="Sessions still waiting for complete AI insights."
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Section
            title="Candidate pipeline"
            description="Group the workflow by live momentum, pending decisions, and final outcomes."
            actions={
              <Select
                value={railFilter}
                onValueChange={(value) =>
                  setRailFilter(value as "all" | WorkflowStage)
                }
              >
                <SelectTrigger className="h-9 w-[170px] rounded-full border-[#e0e5d5] bg-[#fbfdf6]">
                  <SelectValue placeholder="Filter stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="live">Live now</SelectItem>
                  <SelectItem value="review">Needs review</SelectItem>
                  <SelectItem value="potential">Potential</SelectItem>
                  <SelectItem value="selected">Selected</SelectItem>
                  <SelectItem value="interrupted">Interrupted</SelectItem>
                  <SelectItem value="not_selected">Closed out</SelectItem>
                  <SelectItem value="abandoned">Abandoned</SelectItem>
                </SelectContent>
              </Select>
            }
            compact
          >
            <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-3">
              {visibleGroups.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-330px)] pr-1">
                  <div className="space-y-4">
                    {visibleGroups.map((group) => (
                      <div key={group.key} className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                          <div>
                            <p className="text-sm font-semibold text-[#0a1d08]">
                              {group.label}
                            </p>
                            <p className="text-xs text-[#6f7866]">
                              {group.description}
                            </p>
                          </div>
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getWorkflowToneClasses(
                              group.tone,
                            )}`}
                          >
                            {group.count}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {group.candidates.map((candidate) => {
                            const isSelectedRow =
                              selectedCallId === candidate.callId;

                            return (
                              <button
                                key={candidate.callId}
                                type="button"
                                className={`flex w-full items-start justify-between gap-3 rounded-[20px] border px-4 py-4 text-left transition-colors ${
                                  isSelectedRow
                                    ? "border-[#203b14] bg-[#eef4e1]"
                                    : "border-[#e0e5d5] bg-[#f8faf3] hover:border-[#c5ccb6] hover:bg-[#f3f7ea]"
                                }`}
                                onClick={() => {
                                  router.push(
                                    `/interviews/${params.interviewId}?call=${candidate.callId}`,
                                  );
                                  handleResponseClick(candidate.response);
                                }}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[#0a1d08]">
                                    {candidate.displayName}
                                  </p>
                                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#53614d]">
                                    {candidate.summary}
                                  </p>
                                  <p className="mt-2 text-xs text-[#6f7866]">
                                    {formatResponseTime(candidate.createdAt)}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  {candidate.score !== null ? (
                                    <span className="inline-flex rounded-full border border-[#c5ccb6] bg-[#fbfdf6] px-3 py-1 text-xs font-semibold text-[#0a1d08]">
                                      {candidate.score}
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full border border-[#d8ddd0] bg-[#fbfdf6] px-3 py-1 text-xs font-semibold text-[#6f7866]">
                                      Pending
                                    </span>
                                  )}
                                  {!candidate.isViewed &&
                                  candidate.status !== "ongoing" ? (
                                    <p className="mt-2 text-xs font-semibold text-[#4a3212]">
                                      Unopened
                                    </p>
                                  ) : null}
                                  {candidate.status === "ongoing" ? (
                                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#203b14]">
                                      <PlayCircle className="h-3.5 w-3.5" />
                                      Live
                                    </p>
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="p-4">
                  <EmptyState
                    size="compact"
                    icon={<UserRound className="h-5 w-5" />}
                    title="No candidates in this stage"
                    description="Change the filter or share the interview link to start collecting candidate sessions."
                  />
                </div>
              )}
            </div>
          </Section>
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

      {isSharePopupOpen ? (
        <SharePopup
          open={isSharePopupOpen}
          shareContent={
            interview?.readable_slug
              ? `${baseUrl}/call/${interview.readable_slug}`
              : (interview?.url as string)
          }
          onClose={closeSharePopup}
        />
      ) : null}
    </PageShell>
  );
}

export default InterviewHome;
