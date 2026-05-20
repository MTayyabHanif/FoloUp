"use server";

import { OpenAI } from "openai";
import { logger } from "@/lib/logger";
import {
  ANALYTICS_V2_MODEL,
  ANALYTICS_V2_SEED,
  ANALYTICS_V2_TEMPERATURE,
  CALL_ANALYSIS_SENTINEL,
} from "@/lib/analytics-v2.constants";
import {
  applyHardCaps,
  computeCandidateSpeakingSeconds,
  countSubstantiveUserTurns,
  type RetellSignals,
  type RetellTurn,
} from "@/lib/analytics-v2-caps";
import {
  ANALYTICS_V2_JSON_SCHEMA,
  getInterviewAnalyticsPrompt,
  getInterviewAnalyticsPromptV2,
  type RetellCallAnalysisLike,
  type TranscriptTurn,
  SYSTEM_PROMPT,
  SYSTEM_PROMPT_V2,
} from "@/lib/prompts/analytics";
import { InterviewService } from "@/services/interviews.service";
import { ResponseService } from "@/services/responses.service";
import { Question, Seniority } from "@/types/interview";
import { Analytics, AnalyticsV2 } from "@/types/response";

// ============================================================================
// v1 (LEGACY — dual-write only)
// ============================================================================

export const generateInterviewAnalytics = async (payload: {
  callId: string;
  interviewId: string;
  transcript: string;
}) => {
  const { callId, interviewId, transcript } = payload;

  const response = await ResponseService.getResponseByCallId(callId);
  const interview = await InterviewService.getInterviewById(interviewId);

  if (response?.analytics) {
    return { analytics: response.analytics as Analytics, status: 200 };
  }

  const interviewTranscript = transcript || response?.details?.transcript || "";
  const questions = interview?.questions || [];
  const mainInterviewQuestions = questions
    .map((q: Question, index: number) => `${index + 1}. ${q.question}`)
    .join("\n");

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 5,
  });

  const prompt = getInterviewAnalyticsPrompt(
    interviewTranscript,
    mainInterviewQuestions,
  );

  const baseCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
  });

  const basePromptOutput = baseCompletion.choices[0] || {};
  const content = basePromptOutput.message?.content || "";
  const analyticsResponse = JSON.parse(content);

  analyticsResponse.mainInterviewQuestions = questions.map(
    (q: Question) => q.question,
  );

  return { analytics: analyticsResponse, status: 200 };
};

// ============================================================================
// v2 (HIRING-GRADE)
// ============================================================================

export interface RunAnalyticsV2Args {
  /** From the interview record. */
  roleTitle: string;
  companyName: string;
  seniority: Seniority;
  jobDescription: string;
  mustHaves: string[];
  questions: Pick<Question, "question">[];
  /** Total expected duration (seconds), used by the abandoned hard cap. */
  expectedDurationSeconds: number;
  /** Full Retell `transcript_object` — separated turns with word timestamps. */
  transcriptObject: RetellTurn[] | null | undefined;
  /** Retell `call_analysis`, or undefined when absent (sentinel substituted). */
  callAnalysis: RetellCallAnalysisLike | null | undefined;
  /** Retell `disconnection_reason`. */
  disconnectionReason: string | null | undefined;
  /** Total call duration in seconds. */
  durationSeconds: number;
}

/**
 * Run the v2 hiring-grade analytics pipeline.
 *
 * Pipeline:
 *  1. Pre-compute candidateSpeakingSeconds + promptTimeQuestionsAnswered from
 *     transcript_object (BEFORE the model is called — so the model gets them
 *     as ground-truth context, not as something it has to derive).
 *  2. Substitute a sentinel when Retell omitted call_analysis.
 *  3. Build the 11-section v2 prompt.
 *  4. Call OpenAI with temperature=0, seed=7, response_format=json_schema strict.
 *  5. Apply hard caps in code — the model's score is overridden by deterministic
 *     thresholds for no_answers / short_call / abandoned / agent_only_speech.
 *  6. Return final AnalyticsV2.
 */
export async function runAnalyticsV2(
  args: RunAnalyticsV2Args,
): Promise<AnalyticsV2> {
  // 1. Pre-compute signals
  const transcriptObject = Array.isArray(args.transcriptObject)
    ? args.transcriptObject
    : [];

  const candidateSpeakingSeconds = computeCandidateSpeakingSeconds(transcriptObject);
  const promptTimeQuestionsAnswered = countSubstantiveUserTurns(transcriptObject);

  // 2. call_analysis sentinel fallback
  const callAnalysisPresent = !!args.callAnalysis;
  const callAnalysis: RetellCallAnalysisLike =
    args.callAnalysis ?? CALL_ANALYSIS_SENTINEL;

  // 3. Build separated transcript turns for the prompt
  const transcriptTurns: TranscriptTurn[] = transcriptObject
    .filter((t) => t.role === "agent" || t.role === "user")
    .map<TranscriptTurn>((t) => ({
      role: t.role === "user" ? "user" : "agent",
      content: (t.content || "").trim(),
    }))
    .filter((t) => t.content.length > 0);

  const prompt = getInterviewAnalyticsPromptV2({
    roleTitle: args.roleTitle,
    companyName: args.companyName,
    seniority: args.seniority,
    jobDescription: args.jobDescription,
    mustHaves: args.mustHaves,
    questions: args.questions,
    transcriptTurns,
    callAnalysis,
    disconnectionReason: args.disconnectionReason ?? "",
    durationSeconds: Math.round(args.durationSeconds),
    promptTimeQuestionsAnswered,
    candidateSpeakingSeconds: Math.round(candidateSpeakingSeconds),
  });

  // 4. Call OpenAI with deterministic params + json_schema enforcement
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 3,
  });

  // Some SDK versions don't accept `seed` — guard with `as any` and try/catch.
  // If seed is rejected, determinism degrades to temp=0 alone (acceptable).
  let rawJson: string;
  try {
    const completion = await openai.chat.completions.create({
      model: ANALYTICS_V2_MODEL,
      temperature: ANALYTICS_V2_TEMPERATURE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      seed: ANALYTICS_V2_SEED as any,
      messages: [
        { role: "system", content: SYSTEM_PROMPT_V2 },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "analytics_v2",
          strict: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          schema: ANALYTICS_V2_JSON_SCHEMA as any,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    rawJson = completion.choices[0]?.message?.content ?? "";
  } catch (err) {
    logger.error("Analytics v2 OpenAI call failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  let modelOutput: AnalyticsV2;
  try {
    modelOutput = JSON.parse(rawJson) as AnalyticsV2;
  } catch (err) {
    logger.error("Analytics v2 response was not valid JSON", {
      error: err instanceof Error ? err.message : String(err),
      rawLength: rawJson.length,
    });
    throw new Error("Analytics v2: model returned invalid JSON");
  }

  // The model leaves hardRulesTriggered as []; we populate it via applyHardCaps.
  modelOutput.schemaVersion = 2;

  // 5. Apply hard caps deterministically
  const retellSignals: RetellSignals = {
    transcriptObject,
    disconnectionReason: args.disconnectionReason,
    durationSeconds: args.durationSeconds,
    expectedDurationSeconds: args.expectedDurationSeconds,
    callAnalysisPresent,
  };

  const finalAnalytics = applyHardCaps({
    modelOutput,
    retellSignals,
    questionsTotal: args.questions.length,
  });

  // Always-populate callSignals from authoritative sources (model may have echoed wrong)
  finalAnalytics.callSignals = {
    callSummary: callAnalysis.call_summary || "",
    userSentiment: callAnalysis.user_sentiment || "",
    callCompletionRating: callAnalysis.call_completion_rating || "",
    disconnectionReason: args.disconnectionReason || "",
    durationSeconds: Math.round(args.durationSeconds),
  };

  return finalAnalytics;
}
