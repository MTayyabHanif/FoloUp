export type ResponseStatus =
  | "ongoing"
  | "completed"
  | "interrupted"
  | "abandoned";

export interface Response {
  id: bigint;
  created_at: Date;
  name: string | null;
  interview_id: string;
  duration: number;
  call_id: string;
  details: any;
  is_analysed: boolean;
  email: string;
  is_ended: boolean;
  is_viewed: boolean;
  analytics: any;
  candidate_status: string;
  tab_switch_count: number;
  status: ResponseStatus;
  disconnection_reason: string | null;
  questions_covered: number | null;
  last_active_at: string | null;
  session_token: string | null;
  invite_id: string | null;
  /**
   * Proctoring fields (openspec add-interview-proctoring-camera-screen).
   * All nullable — null means proctoring was not enabled for this interview.
   */
  consent_acknowledged_at: string | null;
  /** "granted" | "unavailable" | "denied" | null */
  camera_status: string | null;
  /** "monitor" | "window" | "browser" | "denied" | "unsupported" | null */
  screen_share_type: string | null;
  proctoring_interrupted: boolean;
  /** Path to camera manifest JSON, e.g. "<org>/<resp>/camera.manifest.json" */
  camera_storage_path: string | null;
  screen_storage_path: string | null;
}

/**
 * Hiring-grade analytics shape — produced by `getInterviewAnalyticsPromptV2`
 * + `runAnalyticsV2`. This is the only analytics shape new rows carry.
 *
 * See openspec/changes/archive/2026-05-20-hiring-grade-analytics-scoring/design.md
 * (Decision 2) for the full rationale, dimension weights, and field-by-field
 * semantics.
 */
export interface AnalyticsV2 {
  schemaVersion: 2;
  recommendation:
    | "strong_yes"
    | "yes"
    | "lean_yes"
    | "lean_no"
    | "no"
    | "insufficient_data";
  confidence: "high" | "medium" | "low" | "insufficient";
  /** 0-100. Computed in code from `dimensions[].score * weight` (see analytics-v2-caps.ts). */
  overallScore: number;
  /** 2-3 sentence narrative summary. */
  overallFeedback: string;
  dimensions: Array<{
    name:
      | "role_fit"
      | "depth_of_knowledge"
      | "communication"
      | "problem_solving"
      | "examples_evidence"
      | "professionalism";
    /** 0-10. */
    score: number;
    /** 0-1; full weight set sums to 1.0 (see ANALYTICS_V2_DIMENSION_WEIGHTS). */
    weight: number;
    /** 1-2 sentences citing transcript evidence. */
    feedback: string;
    /** Direct quotes from CANDIDATE turns. Empty array if no evidence. */
    evidenceQuotes: string[];
    /**
     * v3 rubric-aware (openspec rubric-aware-interviewer-and-questions §7).
     * Optional for backward compat — missing means `true` (legacy default).
     * False when the question set provided no opportunity to evaluate this
     * dimension. Service code overrides to false when no question carried
     * `targetDimension === name` (for ACTIVE dimensions only); observational
     * dimensions (communication, professionalism) are never overridden by absence.
     */
    assessed?: boolean;
  }>;
  perQuestionScores: Array<{
    question: string;
    answered: boolean;
    /** 0-5; null when answered=false. */
    score: number | null;
    /** "Not Asked" / "Not Answered" / evidence-backed paragraph. */
    summary: string;
    evidenceQuotes: string[];
  }>;
  redFlags: Array<{
    flag: string;
    severity: "low" | "medium" | "high";
    /** Required for severity=high; may be null otherwise. */
    evidenceQuote: string | null;
  }>;
  /** Must-haves or dimensions with zero transcript signal. */
  evidenceGaps: string[];
  /** Hard caps that fired in code after the model returned. */
  hardRulesTriggered: Array<{
    rule: "no_answers" | "short_call" | "abandoned" | "agent_only_speech";
    detail: string;
  }>;
  /** Computed in code from `transcript_object` word timestamps. */
  candidateSpeakingSeconds: number;
  /** Model-derived (count of perQuestionScores where answered=true). */
  questionsAnswered: number;
  questionsTotal: number;
  callSignals: {
    callSummary: string;
    userSentiment: string;
    callCompletionRating: string;
    disconnectionReason: string;
    durationSeconds: number;
  };
}

/**
 * Sole analytics shape. Old rows (pre-v2 deploy) may still exist in the DB
 * with no `schemaVersion` — UI consumers should call `isAnalyticsV2()` before
 * trusting fields and render a "legacy response" placeholder otherwise.
 */
export type Analytics = AnalyticsV2;

/**
 * Defensive type guard. Returns true only for rows with `schemaVersion: 2`.
 * UI consumers branch on this to skip rendering legacy v1 rows that were
 * written before the v2 cutover (they lack dimensions / redFlags / etc).
 */
export function isAnalyticsV2(
  a: Analytics | Record<string, unknown> | null | undefined,
): a is AnalyticsV2 {
  return (
    !!a &&
    typeof a === "object" &&
    "schemaVersion" in a &&
    (a as { schemaVersion?: unknown }).schemaVersion === 2
  );
}

export interface FeedbackData {
  interview_id: string;
  satisfaction: number | null;
  feedback: string | null;
  email: string | null;
}

export interface CallData {
  call_id: string;
  agent_id: string;
  audio_websocket_protocol: string;
  audio_encoding: string;
  sample_rate: number;
  call_status: string;
  end_call_after_silence_ms: number;
  from_number: string;
  to_number: string;
  metadata: Record<string, unknown>;
  retell_llm_dynamic_variables: {
    customer_name: string;
  };
  drop_call_if_machine_detected: boolean;
  opt_out_sensitive_data_storage: boolean;
  start_timestamp: number;
  end_timestamp: number;
  transcript: string;
  transcript_object: {
    role: "agent" | "user";
    content: string;
    words: {
      word: string;
      start: number;
      end: number;
    }[];
  }[];
  transcript_with_tool_calls: {
    role: "agent" | "user";
    content: string;
    words: {
      word: string;
      start: number;
      end: number;
    }[];
  }[];
  recording_url: string;
  public_log_url: string;
  e2e_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  llm_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  llm_websocket_network_rtt_latency: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    min: number;
    num: number;
  };
  disconnection_reason: string;
  call_analysis: {
    call_summary: string;
    user_sentiment: string;
    agent_sentiment: string;
    agent_task_completion_rating: string;
    agent_task_completion_rating_reason: string;
    call_completion_rating: string;
    call_completion_rating_reason: string;
  };
}
