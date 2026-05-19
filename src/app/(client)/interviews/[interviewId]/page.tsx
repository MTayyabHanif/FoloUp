"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import React, { useState, useEffect, use } from "react";
import { useOrganization } from "@clerk/nextjs";
import { useInterviews } from "@/contexts/interviews.context";
import { Share2, Filter, Pencil, UserIcon, Eye, Palette } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/navigation";
import { ResponseService } from "@/services/responses.service";
import { ClientService } from "@/services/clients.service";
import { Interview } from "@/types/interview";
import { Response } from "@/types/response";
import { formatTimestampToDateHHMM } from "@/lib/utils";
import CallInfo from "@/components/call/callInfo";
import SummaryInfo from "@/components/dashboard/interview/summaryInfo";
import { InterviewService } from "@/services/interviews.service";
import EditInterview from "@/components/dashboard/interview/editInterview";
import Modal from "@/components/dashboard/Modal";
import { toast } from "sonner";
// react-color removed: ChromePicker replaced with curated brand-palette swatches
// (keyboard-accessible via Radix Popover semantics inherited from Modal/Dialog).
// 8-swatch palette mirrors the donut chart palette in summaryInfo.tsx for
// design-language consistency. Brand color always first.
const BRAND_COLOR_PALETTE = [
  "#4F46E5", // FoloUp brand (--ds-brand-bold)
  "#2684FF", // ADS blue
  "#FFAB00", // ADS yellow
  "#36B37E", // ADS green
  "#FF5630", // ADS red-orange
  "#00B8D9", // ADS teal
  "#6554C0", // ADS purple
  "#FF7452", // ADS coral
] as const;
import SharePopup from "@/components/dashboard/interview/sharePopup";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CandidateStatus } from "@/lib/enum";
import LoaderWithText from "@/components/loaders/loader-with-text/loaderWithText";
import {
  PageShell,
  PageHeader,
  Section,
} from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Inbox } from "lucide-react";

interface Props {
  params: Promise<{
    interviewId: string;
  }>;
  searchParams: Promise<{
    call: string;
    edit: boolean;
  }>;
}

const base_url = process.env.NEXT_PUBLIC_LIVE_URL;

function InterviewHome({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: Props) {
  const params = use(paramsPromise);
  const searchParams = use(searchParamsPromise);
  const [interview, setInterview] = useState<Interview>();
  const [responses, setResponses] = useState<Response[]>();
  const { getInterviewById } = useInterviews();
  const [isSharePopupOpen, setIsSharePopupOpen] = useState(false);
  const router = useRouter();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [isGeneratingInsights, setIsGeneratingInsights] =
    useState<boolean>(false);
  const [isViewed, setIsViewed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  // Single source of truth for the interview's brand color. Previous code had
  // two states (themeColor + iconColor) tracking the same DB column; the
  // equality-skip in the apply handler made first saves silently no-op (see
  // BROKEN-FEATURES §2.1). Now the swatch click saves directly.
  const [themeColor, setThemeColor] = useState<string>("#4F46E5");
  const { organization } = useOrganization();
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const seeInterviewPreviewPage = () => {
    const protocol = base_url?.includes("localhost") ? "http" : "https";
    if (interview?.url) {
      const url = interview?.readable_slug
        ? `${protocol}://${base_url}/call/${interview?.readable_slug}`
        : interview.url.startsWith("http")
          ? interview.url
          : `https://${interview.url}`;
      window.open(url, "_blank");
    } else {
      console.error("Interview URL is null or undefined.");
    }
  };

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await getInterviewById(params.interviewId);
        if (response) {
          setInterview(response);
          setIsActive(response.is_active);
          setIsViewed(response.is_viewed);
          setThemeColor(response.theme_color ?? "#4F46E5");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    if (!interview || !isGeneratingInsights) {
      fetchInterview();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getInterviewById, params.interviewId, isGeneratingInsights]);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        if (organization?.id) {
          const data = await ClientService.getOrganizationById(organization.id);
          if (data?.plan) {
            setCurrentPlan(data.plan);
          }
        }
      } catch (error) {
        console.error("Error fetching organization data:", error);
      }
    };

    fetchOrganizationData();
  }, [organization]);
  useEffect(() => {
    const fetchResponses = async () => {
      try {
        const response = await ResponseService.getAllResponses(
          params.interviewId,
        );
        setResponses(response);
        setLoading(true);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.interviewId]);

  const handleDeleteResponse = (deletedCallId: string) => {
    if (responses) {
      setResponses(
        responses.filter((response) => response.call_id !== deletedCallId),
      );
      if (searchParams.call === deletedCallId) {
        router.push(`/interviews/${params.interviewId}`);
      }
    }
  };

  const handleResponseClick = async (response: Response) => {
    try {
      await ResponseService.saveResponse({ is_viewed: true }, response.call_id);
      if (responses) {
        const updatedResponses = responses.map((r) =>
          r.call_id === response.call_id ? { ...r, is_viewed: true } : r,
        );
        setResponses(updatedResponses);
      }
      setIsViewed(true);
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

      toast.success("Theme color updated", {
        position: "bottom-right",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.error("Error", {
        description: "Failed to update the theme color.",
        duration: 3000,
      });
    }
  };

  const handleCandidateStatusChange = (callId: string, newStatus: string) => {
    setResponses((prevResponses) => {
      return prevResponses?.map((response) =>
        response.call_id === callId
          ? { ...response, candidate_status: newStatus }
          : response,
      );
    });
  };

  const openSharePopup = () => {
    setIsSharePopupOpen(true);
  };

  const closeSharePopup = () => {
    setIsSharePopupOpen(false);
  };

  /**
   * Swatch click handler — save immediately if the value actually changed.
   * Closes the picker on every click (swatches are committed values, not
   * a continuous slider).
   */
  const handleColorChange = (hex: string) => {
    if (hex.toLowerCase() !== themeColor.toLowerCase()) {
      setThemeColor(hex);
      handleThemeColorChange(hex);
    }
    setShowColorPicker(false);
  };

  const closeColorPicker = () => setShowColorPicker(false);

  const filterResponses = () => {
    if (!responses) {
      return [];
    }
    if (filterStatus == "ALL") {
      return responses;
    }

    return responses?.filter(
      (response) => response?.candidate_status == filterStatus,
    );
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-1 items-center justify-center py-24">
          <LoaderWithText />
        </div>
      </PageShell>
    );
  }

  const filtered = filterResponses();

  const headerActions = (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                openSharePopup();
              }}
              aria-label="Share interview"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Share</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                seeInterviewPreviewPage();
              }}
              aria-label="Preview interview as a candidate"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Preview</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
              }}
              aria-label="Change theme color"
            >
              <Palette className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                router.push(`/interviews/${params.interviewId}?edit=true`)
              }
              aria-label="Edit interview"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Edit</TooltipContent>
        </Tooltip>

        <div className="ml-2 flex items-center gap-2 border-l pl-3">
          {currentPlan === "free_trial_over" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground">Inactive</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Upgrade your plan to reactivate
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {isActive ? "Active" : "Inactive"}
              </span>
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                aria-label="Toggle interview active"
              />
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );

  const headerDescription = (
    <span className="inline-flex items-center gap-3">
      <span
        className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: themeColor }}
        aria-hidden="true"
      />
      <span className="inline-flex items-center gap-1.5">
        <UserIcon className="h-3.5 w-3.5" />
        {responses?.length ?? 0}{" "}
        {responses?.length === 1 ? "response" : "responses"}
      </span>
    </span>
  );

  return (
    <PageShell className="pb-12">
      <PageHeader
        eyebrow="Interview"
        title={interview?.name ?? "Interview"}
        description={headerDescription}
        actions={headerActions}
      />

      {/* List + detail layout. Sidebar is fixed-width; main pane is flex-1
          min-w-0 so its content cannot push the sidebar around. */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <aside className="w-full shrink-0 lg:w-72 xl:w-80">
          <Section
            compact
            title="Responses"
            actions={
              <Select
                onValueChange={(v) => setFilterStatus(v)}
                defaultValue="ALL"
              >
                <SelectTrigger className="h-8 w-[140px]" aria-label="Filter responses">
                  <Filter className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All</SelectItem>
                  <SelectItem value={CandidateStatus.NO_STATUS}>
                    No status
                  </SelectItem>
                  <SelectItem value={CandidateStatus.NOT_SELECTED}>
                    Not selected
                  </SelectItem>
                  <SelectItem value={CandidateStatus.POTENTIAL}>
                    Potential
                  </SelectItem>
                  <SelectItem value={CandidateStatus.SELECTED}>
                    Selected
                  </SelectItem>
                </SelectContent>
              </Select>
            }
          >
            <div className="rounded-lg border bg-card">
              {filtered.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-260px)]">
                  <ul className="divide-y">
                    {filtered.map((response) => {
                      const isActiveRow =
                        searchParams.call === response.call_id;
                      const statusColor =
                        response.candidate_status === "NOT_SELECTED"
                          ? "bg-red-500"
                          : response.candidate_status === "POTENTIAL"
                            ? "bg-yellow-500"
                            : response.candidate_status === "SELECTED"
                              ? "bg-green-500"
                              : "bg-gray-400";
                      return (
                        <li key={response?.id}>
                          <button
                            type="button"
                            onClick={() => {
                              router.push(
                                `/interviews/${params.interviewId}?call=${response.call_id}`,
                              );
                              handleResponseClick(response);
                            }}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-brand-subtlest focus-visible:outline-none focus-visible:bg-brand-subtlest ${
                              isActiveRow ? "bg-brand-subtle" : ""
                            }`}
                          >
                            <span
                              className={`h-8 w-1 shrink-0 rounded-full ${statusColor}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {response?.name
                                  ? `${response.name}'s response`
                                  : "Anonymous"}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {formatTimestampToDateHHMM(
                                  String(response?.created_at),
                                )}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              {!response.is_viewed ? (
                                <span
                                  className="inline-block h-2 w-2 rounded-full bg-brand-bold"
                                  aria-label="Unviewed"
                                />
                              ) : null}
                              {response.analytics &&
                              response.analytics.overallScore !== undefined ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand-bold bg-white text-xs font-semibold text-brand-bold">
                                        {response.analytics.overallScore}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left">
                                      Overall score
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              ) : (
                <div className="p-4">
                  <EmptyState
                    size="compact"
                    icon={<Inbox className="h-5 w-5" />}
                    title="No responses yet"
                    description="Share the interview link to start collecting responses."
                  />
                </div>
              )}
            </div>
          </Section>
        </aside>

        <main className="min-w-0 flex-1">
          {responses && (
            <div className="rounded-lg border bg-card p-6 shadow-[var(--ds-shadow-raised)]">
              {searchParams.call ? (
                <CallInfo
                  call_id={searchParams.call}
                  onDeleteResponse={handleDeleteResponse}
                  onCandidateStatusChange={handleCandidateStatusChange}
                />
              ) : searchParams.edit ? (
                <EditInterview interview={interview} />
              ) : (
                <SummaryInfo responses={responses} interview={interview} />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Theme picker — width-constrained, swatch grid */}
      <Modal
        open={showColorPicker}
        size="sm"
        closeOnOutsideClick={false}
        onClose={closeColorPicker}
      >
        <div className="w-full max-w-xs">
          <h3 className="mb-4 text-center text-lg font-semibold">
            Choose a theme color
          </h3>
          <div
            role="radiogroup"
            aria-label="Theme color swatches"
            className="grid grid-cols-4 gap-2"
          >
            {BRAND_COLOR_PALETTE.map((hex) => {
              const selected = themeColor.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`Theme color ${hex}`}
                  onClick={() => handleColorChange(hex)}
                  className={`relative h-10 w-10 rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-brand-bold)] focus-visible:ring-offset-2 ${
                    selected
                      ? "ring-2 ring-[var(--ds-brand-bold)] ring-offset-2"
                      : ""
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
        </div>
      </Modal>

      {isSharePopupOpen && (
        <SharePopup
          open={isSharePopupOpen}
          shareContent={
            interview?.readable_slug
              ? `${base_url}/call/${interview?.readable_slug}`
              : (interview?.url as string)
          }
          onClose={closeSharePopup}
        />
      )}
    </PageShell>
  );
}

export default InterviewHome;
