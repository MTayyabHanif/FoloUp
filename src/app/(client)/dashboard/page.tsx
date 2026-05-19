"use client";

import React, { useState, useEffect } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Gem, Plus } from "lucide-react";
import Image from "next/image";

import InterviewCard from "@/components/dashboard/interview/interviewCard";
import CreateInterviewCard from "@/components/dashboard/interview/createInterviewCard";
import { InterviewService } from "@/services/interviews.service";
import { ClientService } from "@/services/clients.service";
import { ResponseService } from "@/services/responses.service";
import { useInterviews } from "@/contexts/interviews.context";
import Modal from "@/components/dashboard/Modal";
import {
  PageShell,
  PageHeader,
  Section,
  DataGrid,
} from "@/components/ui/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Banner } from "@/components/ui/banner";
import { Skeleton } from "@/components/ui/skeleton";

function InterviewsLoader() {
  return (
    <DataGrid cols="3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-60 w-full rounded-xl" />
      ))}
    </DataGrid>
  );
}

function Interviews() {
  const { interviews, interviewsLoading } = useInterviews();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPlan, setCurrentPlan] = useState<string>("");
  const [allowedResponsesCount, setAllowedResponsesCount] =
    useState<number>(10);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      try {
        if (organization?.id) {
          const data = await ClientService.getOrganizationById(organization.id);
          if (data?.plan) {
            setCurrentPlan(data.plan);
            if (data.plan === "free_trial_over") {
              setIsModalOpen(true);
            }
          }
          if (data?.allowed_responses_count) {
            setAllowedResponsesCount(data.allowed_responses_count);
          }
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

      setLoading(true);
      try {
        const totalResponses =
          await ResponseService.getResponseCountByOrganizationId(
            organization.id,
          );
        const hasExceededLimit = totalResponses >= allowedResponsesCount;
        if (hasExceededLimit) {
          setCurrentPlan("free_trial_over");
          await InterviewService.deactivateInterviewsByOrgId(organization.id);
          await ClientService.updateOrganization(
            { plan: "free_trial_over" },
            organization.id,
          );
        }
      } catch (error) {
        console.error("Error fetching responses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResponsesCount();
  }, [organization, currentPlan, allowedResponsesCount]);

  const isOverQuota = currentPlan === "free_trial_over";
  const isLoading = interviewsLoading || loading;
  const hasNoInterviews = !isLoading && interviews.length === 0 && !isOverQuota;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Dashboard"
        title="My interviews"
        description="Create and share AI-powered interviews — track responses, scores, and insights in one place."
      />

      {isOverQuota ? (
        <Banner
          tone="warning"
          title="Free trial limit reached"
          description={`You have hit ${allowedResponsesCount} responses. Upgrade to keep collecting candidate data.`}
          action={
            <button
              onClick={() => setIsModalOpen(true)}
              className="rounded-md bg-brand-bold px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-bolder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ds-brand-bold)]"
            >
              Upgrade
            </button>
          }
        />
      ) : null}

      <Section
        title="Interviews"
        description={
          interviews.length > 0
            ? `${interviews.length} ${interviews.length === 1 ? "interview" : "interviews"}`
            : undefined
        }
      >
        {isLoading ? (
          <InterviewsLoader />
        ) : hasNoInterviews ? (
          <EmptyState
            icon={<Plus className="h-6 w-6" />}
            title="No interviews yet"
            description="Create your first interview to start collecting candidate responses."
            action={<CreateInterviewCard />}
          />
        ) : (
          <DataGrid cols="3">
            {isOverQuota ? (
              <div className="flex h-60 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-700 bg-gray-200 p-6 text-center shadow-md">
                <Plus size={64} strokeWidth={0.5} className="text-gray-700" />
                <p className="text-sm font-medium">
                  Upgrade to create more interviews
                </p>
              </div>
            ) : (
              <CreateInterviewCard />
            )}
            {interviews.map((item) => (
              <InterviewCard
                id={item.id}
                interviewerId={item.interviewer_id}
                key={item.id}
                name={item.name}
                url={item.url ?? ""}
                readableSlug={item.readable_slug}
              />
            ))}
          </DataGrid>
        )}
      </Section>

      {/* Upgrade modal — width-constrained inside the new Dialog wrapper */}
      {isModalOpen && (
        <Modal open={isModalOpen} size="2xl" onClose={() => setIsModalOpen(false)}>
          <div className="flex w-full max-w-xl flex-col space-y-4">
            <div className="flex justify-center text-brand-bold">
              <Gem />
            </div>
            <h3 className="text-center text-xl font-semibold">
              Upgrade to Pro
            </h3>
            <p className="text-center text-sm text-muted-foreground">
              You have reached your limit for the free trial. Please upgrade to
              Pro to continue using our features.
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center justify-center">
                <Image
                  src={"/premium-plan-icon.png"}
                  alt="Premium plan"
                  width={240}
                  height={240}
                />
              </div>

              <div className="grid grid-rows-2 gap-2">
                <div className="rounded-lg border p-4">
                  <h4 className="text-base font-medium">Free Plan</h4>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    <li>10 Responses</li>
                    <li>Basic Support</li>
                    <li>Limited Features</li>
                  </ul>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="text-base font-medium">Pro Plan</h4>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    <li>Flexible Pay-Per-Response</li>
                    <li>Priority Support</li>
                    <li>All Features</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-center text-sm">
              Contact{" "}
              <span className="font-semibold">founders@folo-up.co</span> to
              upgrade your plan.
            </p>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

export default Interviews;
