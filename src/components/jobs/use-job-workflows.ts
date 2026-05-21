"use client";

import { useOrganization } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";

import { useInterviewers } from "@/contexts/interviewers.context";
import { useInterviews } from "@/contexts/interviews.context";
import {
  buildCommandCenterSummary,
  buildHiringWorkflowSummary,
  sortWorkflowsForDashboard,
} from "@/lib/hiring-workflow";
import { ClientService } from "@/services/clients.service";
import { InterviewService } from "@/services/interviews.service";
import { ResponseService } from "@/services/responses.service";
import type { Response } from "@/types/response";

export function useJobWorkflows() {
  const { interviews, interviewsLoading } = useInterviews();
  const { interviewers } = useInterviewers();
  const { organization } = useOrganization();

  const [quotaLoading, setQuotaLoading] = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("");
  const [allowedResponsesCount, setAllowedResponsesCount] = useState(10);
  const [responsesByInterview, setResponsesByInterview] = useState<Record<string, Response[]>>({});

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
        if (data?.allowed_responses_count) {
          setAllowedResponsesCount(data.allowed_responses_count);
        }
      } catch (error) {
        console.error("Error fetching organization data:", error);
      }
    };

    fetchOrganizationData();
  }, [organization]);

  useEffect(() => {
    const fetchResponsesCount = async () => {
      if (!organization || currentPlan !== "free") {
        return;
      }

      setQuotaLoading(true);
      try {
        const totalResponses = await ResponseService.getResponseCountByOrganizationId(
          organization.id,
        );
        const hasExceededLimit = totalResponses >= allowedResponsesCount;
        if (hasExceededLimit) {
          setCurrentPlan("free_trial_over");
          await InterviewService.deactivateInterviewsByOrgId(organization.id);
          await ClientService.updateOrganization({ plan: "free_trial_over" }, organization.id);
        }
      } catch (error) {
        console.error("Error fetching responses:", error);
      } finally {
        setQuotaLoading(false);
      }
    };

    fetchResponsesCount();
  }, [organization, currentPlan, allowedResponsesCount]);

  useEffect(() => {
    let isMounted = true;

    const fetchResponsesForJobs = async () => {
      if (interviewsLoading) {
        return;
      }

      if (interviews.length === 0) {
        setResponsesByInterview({});
        setWorkflowLoading(false);

        return;
      }

      setWorkflowLoading(true);
      try {
        const entries = await Promise.all(
          interviews.map(async (interview) => [
            interview.id,
            await ResponseService.getAllResponses(interview.id),
          ]),
        );

        if (!isMounted) {
          return;
        }

        setResponsesByInterview(Object.fromEntries(entries));
      } catch (error) {
        console.error("Error fetching interview responses:", error);
      } finally {
        if (isMounted) {
          setWorkflowLoading(false);
        }
      }
    };

    fetchResponsesForJobs();

    return () => {
      isMounted = false;
    };
  }, [interviews, interviewsLoading]);

  const workflows = useMemo(
    () =>
      sortWorkflowsForDashboard(
        interviews.map((interview) =>
          buildHiringWorkflowSummary({
            interview,
            responses: responsesByInterview[interview.id] ?? [],
            interviewer: interviewers.find((item) => item.id === interview.interviewer_id) ?? null,
          }),
        ),
      ),
    [interviewers, interviews, responsesByInterview],
  );

  const summary = useMemo(() => buildCommandCenterSummary(workflows), [workflows]);

  const liveSessions = useMemo(
    () =>
      workflows.flatMap((workflow) =>
        workflow.stageBuckets.live.map((candidate) => ({ workflow, candidate })),
      ),
    [workflows],
  );

  const reviewQueue = useMemo(
    () =>
      workflows.flatMap((workflow) =>
        [...workflow.stageBuckets.review, ...workflow.stageBuckets.interrupted].map(
          (candidate) => ({
            workflow,
            candidate,
          }),
        ),
      ),
    [workflows],
  );

  const isOverQuota = currentPlan === "free_trial_over";
  const isLoading = interviewsLoading || quotaLoading || workflowLoading;

  return {
    allowedResponsesCount,
    currentPlan,
    interviews,
    isLoading,
    isOverQuota,
    liveSessions,
    reviewQueue,
    summary,
    workflows,
  };
}
