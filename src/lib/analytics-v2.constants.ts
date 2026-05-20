/**
 * v2 analytics constants. Pinned values; do not edit without bumping the
 * schema version and a calibration re-run.
 *
 * See openspec/changes/hiring-grade-analytics-scoring/design.md.
 */

import type { AnalyticsV2 } from "@/types/response";

type DimensionName = AnalyticsV2["dimensions"][number]["name"];

/**
 * v2 launch dimension weights. Weighted-average × 10 gives overallScore (0-100).
 *
 * INVARIANT: Sum = 1.0. Enforced at module load time below.
 */
export const ANALYTICS_V2_DIMENSION_WEIGHTS: Record<DimensionName, number> = {
  role_fit: 0.25,
  depth_of_knowledge: 0.25,
  problem_solving: 0.2,
  examples_evidence: 0.15,
  communication: 0.1,
  professionalism: 0.05,
};

// Runtime guard — if someone edits the table and forgets to keep it summing
// to 1.0, fail loudly at boot rather than silently producing wrong scores.
{
  const sum = Object.values(ANALYTICS_V2_DIMENSION_WEIGHTS).reduce(
    (a, b) => a + b,
    0,
  );
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new Error(
      `ANALYTICS_V2_DIMENSION_WEIGHTS must sum to 1.0; got ${sum.toFixed(4)}`,
    );
  }
}

/** Dated snapshot — rolling aliases break determinism. */
export const ANALYTICS_V2_MODEL = "gpt-4o-2024-08-06";

/** Deterministic seed for OpenAI `seed` param. */
export const ANALYTICS_V2_SEED = 7;

/** Force greedy decoding. */
export const ANALYTICS_V2_TEMPERATURE = 0;

/**
 * Sentinel for missing `call_analysis` on the Retell payload. Used to keep
 * the prompt and `applyHardCaps` callable when Retell omits analysis.
 */
export const CALL_ANALYSIS_SENTINEL = {
  call_summary: "N/A — Retell did not return call_analysis",
  user_sentiment: "N/A",
  agent_sentiment: "N/A",
  agent_task_completion_rating: "N/A",
  agent_task_completion_rating_reason: "N/A",
  call_completion_rating: "N/A",
  call_completion_rating_reason: "N/A",
} as const;

/**
 * Hard-cap thresholds. Locked at design time — changing requires a calibration
 * re-run and a CHANGELOG entry.
 */
export const HARD_CAPS = {
  /** Below this candidate-speaking-seconds, overallScore is capped at SHORT_CALL_MAX_SCORE. */
  SHORT_CALL_THRESHOLD_SECONDS: 30,
  SHORT_CALL_MAX_SCORE: 40,
  /** Cap when 0 questions answered. */
  NO_ANSWERS_MAX_SCORE: 20,
  /** Cap when the call was abandoned before half the expected duration. */
  ABANDONED_MAX_SCORE: 50,
  /** Stronger cap when the candidate never spoke at all. */
  AGENT_ONLY_MAX_SCORE: 10,
  /** Disconnection reasons that count as "abandoned" for the abandoned cap. */
  ABANDONED_REASONS: [
    "user_hangup",
    "dial_no_answer",
    "inactivity",
    "error",
    "concurrency_limit_reached",
    "registered_call_timeout",
    "error_user_not_joined",
  ] as readonly string[],
} as const;

/** Substantive-user-turn heuristic (matches retellReviewArtifacts.countQuestionsCovered). */
export const SUBSTANTIVE_TURN_MIN_WORDS = 8;
export const SUBSTANTIVE_TURN_MIN_CHARS = 40;
