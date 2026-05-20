"use client";

import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/page-shell";
import {
  WORKFLOW_STAGE_ORDER,
  getWorkflowToneClasses,
  type HiringWorkflowSummary,
  type StageGroup,
  type WorkflowCandidate,
  type WorkflowStage,
} from "@/lib/hiring-workflow";

import { SessionRow } from "./session-row";
import {
  SessionsToolbar,
  type SessionSortKey,
  type StageChip,
} from "./sessions-toolbar";

type SessionsPanelProps = {
  workflow: HiringWorkflowSummary;
  interviewId: string;
  selectedCallId: string;
  railFilter: "all" | WorkflowStage;
  onRailFilterChange: (next: "all" | WorkflowStage) => void;
  onSelectCandidate: (candidate: WorkflowCandidate) => void;
};

const STAGE_LABEL_LOOKUP: Record<WorkflowStage, string> = {
  live: "Live",
  review: "Review",
  potential: "Potential",
  selected: "Selected",
  interrupted: "Interrupted",
  not_selected: "Closed",
  abandoned: "Abandoned",
};

function isUnread(candidate: WorkflowCandidate): boolean {
  return !candidate.isViewed && candidate.status !== "ongoing";
}

function compareByRecency(a: WorkflowCandidate, b: WorkflowCandidate): number {
  const aTime = a.createdAt ? a.createdAt.getTime() : 0;
  const bTime = b.createdAt ? b.createdAt.getTime() : 0;

  return bTime - aTime;
}

function compareByScore(a: WorkflowCandidate, b: WorkflowCandidate): number {
  const aScore = a.score ?? -1;
  const bScore = b.score ?? -1;

  return bScore - aScore;
}

function compareByName(a: WorkflowCandidate, b: WorkflowCandidate): number {
  return a.displayName.localeCompare(b.displayName);
}

export function SessionsPanel({
  workflow,
  interviewId,
  selectedCallId,
  railFilter,
  onRailFilterChange,
  onSelectCandidate,
}: SessionsPanelProps) {
  const [query, setQuery] = useState<string>("");
  const [sortKey, setSortKey] = useState<SessionSortKey>("recency");
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);

  const stageChips: StageChip[] = useMemo(() => {
    const chips: StageChip[] = [
      { key: "all", label: "All", count: workflow.totalResponses },
    ];

    for (const stage of WORKFLOW_STAGE_ORDER) {
      const count = workflow.stageBuckets[stage]?.length ?? 0;
      if (count === 0) {
        continue;
      }

      chips.push({
        key: stage,
        label: STAGE_LABEL_LOOKUP[stage],
        count,
      });
    }

    return chips;
  }, [workflow.stageBuckets, workflow.totalResponses]);

  const stageMetaLookup = useMemo(() => {
    const lookup: Partial<Record<WorkflowStage, Pick<StageGroup, "label" | "tone">>> = {};
    for (const group of workflow.stageGroups) {
      lookup[group.key] = { label: group.label, tone: group.tone };
    }

    return lookup;
  }, [workflow.stageGroups]);

  const filteredCandidates = useMemo(() => {
    const lowered = query.trim().toLowerCase();

    return workflow.responses.filter((candidate) => {
      if (railFilter !== "all" && candidate.stage !== railFilter) {
        return false;
      }

      if (unreadOnly && !isUnread(candidate)) {
        return false;
      }

      if (lowered.length > 0) {
        const haystack = candidate.displayName.toLowerCase();
        if (!haystack.includes(lowered)) {
          return false;
        }
      }

      return true;
    });
  }, [workflow.responses, railFilter, unreadOnly, query]);

  const visibleGroups = useMemo(() => {
    if (sortKey !== "stage") {
      return null;
    }

    return WORKFLOW_STAGE_ORDER.map((stage) => {
      const groupMeta = workflow.stageGroups.find((group) => group.key === stage);
      const candidates = filteredCandidates.filter(
        (candidate) => candidate.stage === stage,
      );
      if (candidates.length === 0 || !groupMeta) {
        return null;
      }

      return {
        ...groupMeta,
        candidates,
        count: candidates.length,
      };
    }).filter((group): group is StageGroup => group !== null);
  }, [sortKey, filteredCandidates, workflow.stageGroups]);

  const flatCandidates = useMemo(() => {
    if (sortKey === "stage") {
      return null;
    }

    const next = [...filteredCandidates];
    if (sortKey === "recency") {
      next.sort(compareByRecency);
    } else if (sortKey === "score") {
      next.sort(compareByScore);
    } else if (sortKey === "name") {
      next.sort(compareByName);
    }

    return next;
  }, [filteredCandidates, sortKey]);

  const hasResults = filteredCandidates.length > 0;
  const showInlineStage = sortKey !== "stage";

  return (
    <Section
      title="Sessions"
      description={`${filteredCandidates.length} of ${workflow.totalResponses} candidate${
        workflow.totalResponses === 1 ? "" : "s"
      } visible`}
      compact
    >
      <div className="overflow-hidden rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6]">
        <SessionsToolbar
          query={query}
          onQueryChange={setQuery}
          stageChips={stageChips}
          railFilter={railFilter}
          onRailFilterChange={onRailFilterChange}
          sortKey={sortKey}
          onSortKeyChange={setSortKey}
          unreadOnly={unreadOnly}
          onUnreadOnlyChange={setUnreadOnly}
        />

        {hasResults ? (
          <ScrollArea className="h-[calc(100vh-360px)] min-h-[360px]">
            <div className="space-y-4 p-3">
              {visibleGroups
                ? visibleGroups.map((group) => (
                    <div key={group.key} className="space-y-2">
                      <div className="flex items-center justify-between px-1">
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
                        {group.candidates.map((candidate) => (
                          <SessionRow
                            key={candidate.callId}
                            candidate={candidate}
                            interviewId={interviewId}
                            isSelected={selectedCallId === candidate.callId}
                            onSelect={onSelectCandidate}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                : null}

              {flatCandidates ? (
                <div className="space-y-2">
                  {flatCandidates.map((candidate) => (
                    <SessionRow
                      key={candidate.callId}
                      candidate={candidate}
                      interviewId={interviewId}
                      isSelected={selectedCallId === candidate.callId}
                      stageMeta={
                        showInlineStage
                          ? stageMetaLookup[candidate.stage]
                          : undefined
                      }
                      onSelect={onSelectCandidate}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-4">
            <EmptyState
              size="compact"
              icon={<UserRound className="h-5 w-5" />}
              title="No candidates match these filters"
              description="Clear the search, switch the stage chip, or turn off the unread-only toggle to see more sessions."
            />
          </div>
        )}
      </div>
    </Section>
  );
}

export default SessionsPanel;
