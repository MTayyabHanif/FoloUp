import { CandidateStatus } from "@/lib/enum";
import type { Interview } from "@/types/interview";
import type { Interviewer } from "@/types/interviewer";
import type { Response } from "@/types/response";

export const DEFAULT_IDENTITY_COLOR = "#203b14";

export type WorkflowStage =
  | "live"
  | "review"
  | "potential"
  | "selected"
  | "interrupted"
  | "not_selected"
  | "abandoned";

export type WorkflowTone =
  | "default"
  | "success"
  | "warning"
  | "critical"
  | "muted";

export type WorkflowCandidate = {
  callId: string;
  createdAt: Date | null;
  displayName: string;
  status: Response["status"];
  decision: CandidateStatus;
  stage: WorkflowStage;
  score: number | null;
  duration: number;
  summary: string;
  sentiment: string | null;
  questionsCovered: number | null;
  isViewed: boolean;
  isAnalysed: boolean;
  disconnectionReason: string | null;
  response: Response;
};

export type StageGroup = {
  key: WorkflowStage;
  label: string;
  tone: WorkflowTone;
  description: string;
  candidates: WorkflowCandidate[];
  count: number;
};

export type HiringWorkflowSummary = {
  interview: Interview;
  interviewer: Interviewer | null;
  title: string;
  objective: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  identityColor: string;
  responses: WorkflowCandidate[];
  stageGroups: StageGroup[];
  stageBuckets: Record<WorkflowStage, WorkflowCandidate[]>;
  totalResponses: number;
  liveCount: number;
  reviewCount: number;
  potentialCount: number;
  selectedCount: number;
  interruptedCount: number;
  notSelectedCount: number;
  abandonedCount: number;
  completedCount: number;
  viewedPendingCount: number;
  analysisPendingCount: number;
  avgScore: number | null;
  avgDurationSeconds: number | null;
  completionRate: number;
  shortlistedCount: number;
  attentionCount: number;
  topCandidate: WorkflowCandidate | null;
  recentCandidate: WorkflowCandidate | null;
  healthLabel: string;
  healthTone: WorkflowTone;
  healthSummary: string;
};

const STAGE_META: Record<
  WorkflowStage,
  { label: string; tone: WorkflowTone; description: string }
> = {
  live: {
    label: "Live now",
    tone: "success",
    description: "Candidates currently in session.",
  },
  review: {
    label: "Needs review",
    tone: "warning",
    description: "Finished sessions waiting for a hiring decision.",
  },
  potential: {
    label: "Potential",
    tone: "default",
    description: "Worth discussing with the team.",
  },
  selected: {
    label: "Selected",
    tone: "success",
    description: "Shortlisted candidates ready for next steps.",
  },
  interrupted: {
    label: "Interrupted",
    tone: "critical",
    description: "Sessions that ended early or need follow-up.",
  },
  not_selected: {
    label: "Closed out",
    tone: "muted",
    description: "Reviewed candidates who are not moving forward.",
  },
  abandoned: {
    label: "Abandoned",
    tone: "muted",
    description: "Links opened but no meaningful session completed.",
  },
};

export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  "live",
  "review",
  "potential",
  "selected",
  "interrupted",
  "not_selected",
  "abandoned",
];

export function normalizeCandidateDecision(
  candidateStatus?: string | null,
): CandidateStatus {
  if (candidateStatus === CandidateStatus.NOT_SELECTED) {
    return CandidateStatus.NOT_SELECTED;
  }
  if (candidateStatus === CandidateStatus.POTENTIAL) {
    return CandidateStatus.POTENTIAL;
  }
  if (candidateStatus === CandidateStatus.SELECTED) {
    return CandidateStatus.SELECTED;
  }

  return CandidateStatus.NO_STATUS;
}

/**
 * Read the overall score from the response's analytics, regardless of schema
 * version. Both `AnalyticsV1.overallScore` and `AnalyticsV2.overallScore` use
 * the same field name and 0-100 scale, so a single accessor works for both.
 *
 * For v2 rows with `recommendation === 'insufficient_data'`, the overallScore
 * is real but anchored low by hard caps — callers that sort/rank should treat
 * insufficient_data rows as a separate bucket (see workflow stage logic).
 */
export function getResponseScore(response: Response): number | null {
  const score = response.analytics?.overallScore;

  return typeof score === "number" ? score : null;
}

/**
 * Schema-aware summary accessor. v2 uses `overallFeedback`; v1 uses
 * `softSkillSummary`. Falls back to Retell's call_summary, then a placeholder.
 */
export function getResponseSummary(response: Response): string {
  const a = response.analytics;
  const v2Feedback =
    a && typeof a === "object" && "schemaVersion" in a && a.schemaVersion === 2
      ? a.overallFeedback
      : undefined;

  return (
    v2Feedback ||
    a?.softSkillSummary ||
    response.details?.call_analysis?.call_summary ||
    "Waiting for the interview summary."
  );
}

export function getWorkflowStage(response: Response): WorkflowStage {
  const decision = normalizeCandidateDecision(response.candidate_status);

  if (response.status === "ongoing") {
    return "live";
  }
  if (decision === CandidateStatus.SELECTED) {
    return "selected";
  }
  if (decision === CandidateStatus.POTENTIAL) {
    return "potential";
  }
  if (decision === CandidateStatus.NOT_SELECTED) {
    return "not_selected";
  }
  if (response.status === "interrupted") {
    return "interrupted";
  }
  if (response.status === "abandoned") {
    return "abandoned";
  }

  return "review";
}

export function formatDurationLabel(durationMinutes: number): string {
  if (!durationMinutes) {
    return "Flexible timing";
  }
  if (durationMinutes === 1) {
    return "1 minute";
  }

  return `${durationMinutes} minutes`;
}

export function formatResponseTime(date: Date | string | null): string {
  if (!date) {
    return "Just now";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getWorkflowToneClasses(tone: WorkflowTone): string {
  switch (tone) {
    case "success":
      return "border-[#c7d6b4] bg-[#eef4e1] text-[#203b14]";
    case "warning":
      return "border-[#d8c7b6] bg-[#f7efe8] text-[#4a3212]";
    case "critical":
      return "border-[#d7bdb7] bg-[#f6ebe7] text-[#6b3f31]";
    case "muted":
      return "border-[#d8ddd0] bg-[#f5f7ef] text-[#576254]";
    default:
      return "border-[#d8ddd0] bg-[#f5f7ef] text-[#203b14]";
  }
}

function toCandidate(response: Response): WorkflowCandidate {
  const createdAt = response.created_at ? new Date(response.created_at) : null;

  return {
    callId: response.call_id,
    createdAt:
      createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : null,
    displayName: response.name?.trim() || "Anonymous candidate",
    status: response.status,
    decision: normalizeCandidateDecision(response.candidate_status),
    stage: getWorkflowStage(response),
    score: getResponseScore(response),
    duration: response.duration ?? 0,
    summary: getResponseSummary(response),
    sentiment: response.details?.call_analysis?.user_sentiment ?? null,
    questionsCovered:
      typeof response.questions_covered === "number"
        ? response.questions_covered
        : null,
    isViewed: Boolean(response.is_viewed),
    isAnalysed: Boolean(response.is_analysed),
    disconnectionReason: response.disconnection_reason ?? null,
    response,
  };
}

function scoreCandidate(candidate: WorkflowCandidate): number {
  const stageWeight: Record<WorkflowStage, number> = {
    selected: 700,
    potential: 600,
    review: 500,
    live: 450,
    interrupted: 300,
    abandoned: 200,
    not_selected: 100,
  };

  const recencyWeight = candidate.createdAt
    ? candidate.createdAt.getTime() / 1_000_000_000_000
    : 0;

  return (
    stageWeight[candidate.stage] +
    (candidate.score ?? 0) +
    (candidate.isViewed ? 0 : 20) +
    recencyWeight
  );
}

function getHealth(
  counts: Pick<
    HiringWorkflowSummary,
    | "totalResponses"
    | "liveCount"
    | "reviewCount"
    | "interruptedCount"
    | "selectedCount"
    | "potentialCount"
    | "abandonedCount"
  >,
): Pick<HiringWorkflowSummary, "healthLabel" | "healthTone" | "healthSummary"> {
  if (counts.liveCount > 0) {
    return {
      healthLabel: "Live hiring",
      healthTone: "success",
      healthSummary: `${counts.liveCount} candidate${counts.liveCount === 1 ? "" : "s"} in session right now.`,
    };
  }

  if (counts.reviewCount > 0) {
    return {
      healthLabel: "Needs review",
      healthTone: "warning",
      healthSummary: `${counts.reviewCount} finished candidate${counts.reviewCount === 1 ? "" : "s"} still need a decision.`,
    };
  }

  if (counts.interruptedCount > 0) {
    return {
      healthLabel: "Session recovery",
      healthTone: "critical",
      healthSummary: `${counts.interruptedCount} interview${counts.interruptedCount === 1 ? "" : "s"} ended early and may need follow-up.`,
    };
  }

  if (counts.selectedCount > 0 || counts.potentialCount > 0) {
    return {
      healthLabel: "Healthy pipeline",
      healthTone: "success",
      healthSummary: `${counts.selectedCount + counts.potentialCount} candidate${counts.selectedCount + counts.potentialCount === 1 ? "" : "s"} are moving forward.`,
    };
  }

  if (counts.totalResponses === 0) {
    return {
      healthLabel: "Awaiting candidates",
      healthTone: "default",
      healthSummary: "Share the interview link to start building your pipeline.",
    };
  }

  if (counts.abandonedCount > 0) {
    return {
      healthLabel: "Drop-off risk",
      healthTone: "muted",
      healthSummary: `${counts.abandonedCount} candidate${counts.abandonedCount === 1 ? "" : "s"} left before finishing.`,
    };
  }

  return {
    healthLabel: "Steady flow",
    healthTone: "default",
    healthSummary: "Candidates are moving through the workflow without urgent blockers.",
  };
}

export function buildHiringWorkflowSummary(args: {
  interview: Interview;
  responses?: Response[];
  interviewer?: Interviewer | null;
}): HiringWorkflowSummary {
  const { interview, interviewer = null } = args;
  const responses = [...(args.responses ?? [])];
  const candidates = responses
    .map(toCandidate)
    .sort((left, right) => scoreCandidate(right) - scoreCandidate(left));

  const stageBuckets = WORKFLOW_STAGE_ORDER.reduce(
    (acc, key) => {
      acc[key] = [];
      
return acc;
    },
    {} as Record<WorkflowStage, WorkflowCandidate[]>,
  );

  candidates.forEach((candidate) => {
    stageBuckets[candidate.stage].push(candidate);
  });

  const stageGroups = WORKFLOW_STAGE_ORDER.map((key) => ({
    key,
    label: STAGE_META[key].label,
    tone: STAGE_META[key].tone,
    description: STAGE_META[key].description,
    candidates: stageBuckets[key],
    count: stageBuckets[key].length,
  }));

  const completedResponses = responses.filter(
    (response) => response.status === "completed",
  ).length;
  const analysedScores = candidates
    .map((candidate) => candidate.score)
    .filter((score): score is number => typeof score === "number");
  const avgScore =
    analysedScores.length > 0
      ? Math.round(
          analysedScores.reduce((total, score) => total + score, 0) /
            analysedScores.length,
        )
      : null;
  const avgDurationSeconds =
    candidates.length > 0
      ? Math.round(
          candidates.reduce((total, candidate) => total + candidate.duration, 0) /
            candidates.length,
        )
      : null;

  const totalResponses = candidates.length;
  const reviewCount = stageBuckets.review.length;
  const liveCount = stageBuckets.live.length;
  const selectedCount = stageBuckets.selected.length;
  const potentialCount = stageBuckets.potential.length;
  const interruptedCount = stageBuckets.interrupted.length;
  const notSelectedCount = stageBuckets.not_selected.length;
  const abandonedCount = stageBuckets.abandoned.length;
  const analysisPendingCount = candidates.filter(
    (candidate) =>
      !candidate.isAnalysed && candidate.status !== "ongoing" && candidate.status !== "abandoned",
  ).length;
  const viewedPendingCount = candidates.filter(
    (candidate) => !candidate.isViewed && candidate.status !== "ongoing",
  ).length;

  const health = getHealth({
    totalResponses,
    liveCount,
    reviewCount,
    interruptedCount,
    selectedCount,
    potentialCount,
    abandonedCount,
  });

  return {
    interview,
    interviewer,
    title: interview.name || "Untitled job",
    objective: interview.objective || "Define the hiring signal for this role.",
    description:
      interview.description || "Use this workspace to guide and review candidate sessions.",
    durationMinutes: Number(interview.time_duration) || 0,
    questionCount: interview.question_count || interview.questions?.length || 0,
    identityColor: interview.theme_color || DEFAULT_IDENTITY_COLOR,
    responses: candidates,
    stageGroups,
    stageBuckets,
    totalResponses,
    liveCount,
    reviewCount,
    potentialCount,
    selectedCount,
    interruptedCount,
    notSelectedCount,
    abandonedCount,
    completedCount: completedResponses,
    viewedPendingCount,
    analysisPendingCount,
    avgScore,
    avgDurationSeconds,
    completionRate:
      totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0,
    shortlistedCount: selectedCount + potentialCount,
    attentionCount: liveCount + reviewCount + interruptedCount,
    topCandidate: candidates[0] ?? null,
    recentCandidate:
      [...candidates]
        .sort(
          (left, right) =>
            (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0),
        )[0] ?? null,
    ...health,
  };
}

export function sortWorkflowsForDashboard(
  workflows: HiringWorkflowSummary[],
): HiringWorkflowSummary[] {
  return [...workflows].sort((left, right) => {
    if (right.attentionCount !== left.attentionCount) {
      return right.attentionCount - left.attentionCount;
    }
    if (right.selectedCount !== left.selectedCount) {
      return right.selectedCount - left.selectedCount;
    }
    if (right.totalResponses !== left.totalResponses) {
      return right.totalResponses - left.totalResponses;
    }

    return (
      (right.recentCandidate?.createdAt?.getTime() ?? 0) -
      (left.recentCandidate?.createdAt?.getTime() ?? 0)
    );
  });
}

export function buildCommandCenterSummary(
  workflows: HiringWorkflowSummary[],
): {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  liveSessions: number;
  reviewQueue: number;
  interruptedSessions: number;
  shortlistedCandidates: number;
  totalResponses: number;
} {
  return workflows.reduce(
    (summary, workflow) => ({
      totalJobs: summary.totalJobs + 1,
      activeJobs: summary.activeJobs + (workflow.interview.is_active ? 1 : 0),
      pausedJobs: summary.pausedJobs + (workflow.interview.is_active ? 0 : 1),
      liveSessions: summary.liveSessions + workflow.liveCount,
      reviewQueue: summary.reviewQueue + workflow.reviewCount,
      interruptedSessions:
        summary.interruptedSessions + workflow.interruptedCount,
      shortlistedCandidates:
        summary.shortlistedCandidates + workflow.shortlistedCount,
      totalResponses: summary.totalResponses + workflow.totalResponses,
    }),
    {
      totalJobs: 0,
      activeJobs: 0,
      pausedJobs: 0,
      liveSessions: 0,
      reviewQueue: 0,
      interruptedSessions: 0,
      shortlistedCandidates: 0,
      totalResponses: 0,
    },
  );
}

