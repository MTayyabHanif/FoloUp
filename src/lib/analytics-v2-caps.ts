/**
 * Hard-cap pure functions for v2 analytics.
 *
 * The model is told about the hard caps in the prompt, but the SERVICE applies
 * them in code from Retell's deterministic signals after the model returns.
 * This is the structural fix for the 78/100 hung-up-call bug.
 *
 * Pure — no I/O, no OpenAI calls. Trivially unit-testable.
 *
 * See openspec/changes/hiring-grade-analytics-scoring/design.md (Decision 3, 11).
 */

import {
  ANALYTICS_V2_DIMENSION_WEIGHTS,
  HARD_CAPS,
  SUBSTANTIVE_TURN_MIN_CHARS,
  SUBSTANTIVE_TURN_MIN_WORDS,
} from "./analytics-v2.constants.ts";
import type { AnalyticsV2 } from "@/types/response";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetellWord {
  word: string;
  start: number;
  end: number;
}

export interface RetellTurn {
  role: "agent" | "user" | string;
  content?: string;
  words?: RetellWord[];
}

export interface RetellSignals {
  /** Full Retell transcript_object. May be missing entirely. */
  transcriptObject: RetellTurn[] | null | undefined;
  /** Retell disconnection_reason string. */
  disconnectionReason: string | null | undefined;
  /** Total call duration (seconds). */
  durationSeconds: number;
  /** The interview's expected duration in seconds (from interview.time_duration). */
  expectedDurationSeconds: number;
  /** Whether call_analysis was present on the Retell payload. */
  callAnalysisPresent: boolean;
}

// ---------------------------------------------------------------------------
// Speaking-seconds computation (word-level — turn-level timestamps do not exist)
// ---------------------------------------------------------------------------

function computeRoleSpeakingSeconds(
  transcriptObject: RetellTurn[] | null | undefined,
  role: "user" | "agent",
): number {
  if (!Array.isArray(transcriptObject) || transcriptObject.length === 0) {
    return 0;
  }
  let total = 0;
  for (const turn of transcriptObject) {
    if (turn.role !== role) {continue;}
    const words = Array.isArray(turn.words) ? turn.words : [];
    if (words.length === 0) {continue;}
    const first = words[0];
    const last = words[words.length - 1];
    if (
      typeof first?.start === "number" &&
      typeof last?.end === "number" &&
      last.end > first.start
    ) {
      total += last.end - first.start;
    }
  }
  return Math.max(0, total);
}

export function computeCandidateSpeakingSeconds(
  transcriptObject: RetellTurn[] | null | undefined,
): number {
  return computeRoleSpeakingSeconds(transcriptObject, "user");
}

export function computeAgentSpeakingSeconds(
  transcriptObject: RetellTurn[] | null | undefined,
): number {
  return computeRoleSpeakingSeconds(transcriptObject, "agent");
}

/**
 * Count substantive user turns. Matches the existing
 * `retellReviewArtifacts.countQuestionsCovered` heuristic.
 *
 * A user turn is substantive when it has >= SUBSTANTIVE_TURN_MIN_WORDS words
 * OR >= SUBSTANTIVE_TURN_MIN_CHARS characters of content. This filters out
 * fillers like "yeah", "um", "right".
 */
export function countSubstantiveUserTurns(
  transcriptObject: RetellTurn[] | null | undefined,
): number {
  if (!Array.isArray(transcriptObject)) {return 0;}
  let count = 0;
  for (const turn of transcriptObject) {
    if (turn.role !== "user") {continue;}
    const content = (turn.content || "").trim();
    if (!content) {continue;}
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (
      wordCount >= SUBSTANTIVE_TURN_MIN_WORDS ||
      content.length >= SUBSTANTIVE_TURN_MIN_CHARS
    ) {
      count += 1;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// overallScore from dimensions
// ---------------------------------------------------------------------------

/**
 * Recompute `overallScore` from dimension scores using the locked weights.
 * Protects against the model arithmetic-failing on the weighted average.
 */
export function computeOverallScoreFromDimensions(
  dimensions: AnalyticsV2["dimensions"],
): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const dim of dimensions) {
    const w =
      ANALYTICS_V2_DIMENSION_WEIGHTS[dim.name] ?? dim.weight ?? 0;
    weighted += (dim.score || 0) * w;
    totalWeight += w;
  }
  if (totalWeight === 0) {return 0;}
  // Normalize against actual weight applied (defensive — if the model omitted
  // a dimension, we still produce a sensible score).
  const normalized = weighted / totalWeight;
  return Math.round(Math.max(0, Math.min(10, normalized)) * 10);
}

// ---------------------------------------------------------------------------
// Hard-cap application
// ---------------------------------------------------------------------------

interface HardCapInput {
  modelOutput: AnalyticsV2;
  retellSignals: RetellSignals;
  questionsTotal: number;
}

/**
 * Apply hard caps to the model's output. Returns a new AnalyticsV2 object
 * (does not mutate the input).
 *
 * Order of operations:
 *  1. Compute speaking-seconds + substantive-turn counts from signals.
 *  2. Recompute overallScore from dimensions (defensive — the model's
 *     overallScore may not match its dimension scores).
 *  3. Determine which hard rules fire.
 *  4. Apply the lowest cap (most conservative wins).
 *  5. Force recommendation/confidence to insufficient_data when applicable.
 */
export function applyHardCaps(input: HardCapInput): AnalyticsV2 {
  const { modelOutput, retellSignals, questionsTotal } = input;

  const candidateSpeakingSeconds = computeCandidateSpeakingSeconds(
    retellSignals.transcriptObject,
  );
  const agentSpeakingSeconds = computeAgentSpeakingSeconds(
    retellSignals.transcriptObject,
  );

  // Model-derived questionsAnswered (truth for downstream consumers).
  const questionsAnswered = (modelOutput.perQuestionScores || []).filter(
    (q) => q.answered,
  ).length;

  // Recompute overallScore from dimensions — protects against the model
  // returning a score that doesn't match its own dimension grades.
  const dimensionOverall = computeOverallScoreFromDimensions(
    modelOutput.dimensions || [],
  );

  // ---------- Determine triggered rules ----------
  const triggered: AnalyticsV2["hardRulesTriggered"] = [];
  const caps: number[] = [];
  let forceInsufficient = false;

  // Rule: no_answers
  if (questionsAnswered === 0) {
    triggered.push({
      rule: "no_answers",
      detail: `0 of ${questionsTotal} questions answered`,
    });
    caps.push(HARD_CAPS.NO_ANSWERS_MAX_SCORE);
    forceInsufficient = true;
  }

  // Rule: short_call (only meaningful when transcript_object exists and shows >0 seconds)
  const transcriptObjectExists =
    Array.isArray(retellSignals.transcriptObject) &&
    retellSignals.transcriptObject.length > 0;

  if (
    transcriptObjectExists &&
    candidateSpeakingSeconds < HARD_CAPS.SHORT_CALL_THRESHOLD_SECONDS
  ) {
    triggered.push({
      rule: "short_call",
      detail: `Candidate spoke for ~${Math.round(candidateSpeakingSeconds)}s (< ${HARD_CAPS.SHORT_CALL_THRESHOLD_SECONDS}s threshold)`,
    });
    caps.push(HARD_CAPS.SHORT_CALL_MAX_SCORE);
  }

  // Rule: abandoned
  const disconnectReason = (retellSignals.disconnectionReason || "").toLowerCase();
  const isAbandonedReason =
    disconnectReason.startsWith("error") ||
    HARD_CAPS.ABANDONED_REASONS.some((r) => disconnectReason === r);
  const halfExpected = retellSignals.expectedDurationSeconds * 0.5;
  if (
    isAbandonedReason &&
    retellSignals.expectedDurationSeconds > 0 &&
    retellSignals.durationSeconds < halfExpected
  ) {
    triggered.push({
      rule: "abandoned",
      detail: `Call ended early (${Math.round(retellSignals.durationSeconds)}s vs ~${Math.round(retellSignals.expectedDurationSeconds)}s expected; reason: ${retellSignals.disconnectionReason || "unknown"})`,
    });
    caps.push(HARD_CAPS.ABANDONED_MAX_SCORE);
  }

  // Rule: agent_only_speech (or transcript_object missing entirely)
  if (!transcriptObjectExists && agentSpeakingSeconds === 0) {
    // transcript_object missing: we can't verify; treat conservatively
    triggered.push({
      rule: "agent_only_speech",
      detail: "transcript_object unavailable; cannot verify candidate speech",
    });
    caps.push(HARD_CAPS.AGENT_ONLY_MAX_SCORE);
    forceInsufficient = true;
  } else if (
    transcriptObjectExists &&
    candidateSpeakingSeconds === 0 &&
    agentSpeakingSeconds > 30
  ) {
    triggered.push({
      rule: "agent_only_speech",
      detail: `Candidate never spoke (agent spoke ${Math.round(agentSpeakingSeconds)}s)`,
    });
    caps.push(HARD_CAPS.AGENT_ONLY_MAX_SCORE);
    forceInsufficient = true;
  }

  // Rule: call_analysis missing → reuse agent_only_speech as a generic
  // "reduced signal" trigger (per design.md Decision 6 note).
  if (!retellSignals.callAnalysisPresent) {
    triggered.push({
      rule: "agent_only_speech",
      detail: "call_analysis missing — limited signal",
    });
    // Don't cap on this alone; it's an evidence-quality flag.
  }

  // ---------- Apply the lowest cap ----------
  const minCap = caps.length > 0 ? Math.min(...caps) : 100;
  const finalScore = Math.max(0, Math.min(dimensionOverall, minCap));

  const recommendation: AnalyticsV2["recommendation"] = forceInsufficient
    ? "insufficient_data"
    : modelOutput.recommendation;
  const confidence: AnalyticsV2["confidence"] = forceInsufficient
    ? "insufficient"
    : modelOutput.confidence;

  return {
    ...modelOutput,
    schemaVersion: 2,
    recommendation,
    confidence,
    overallScore: finalScore,
    hardRulesTriggered: triggered,
    candidateSpeakingSeconds: Math.round(candidateSpeakingSeconds),
    questionsAnswered,
    questionsTotal,
  };
}
