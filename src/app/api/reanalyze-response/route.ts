/**
 * POST /api/reanalyze-response
 *
 * Manually re-runs the v2 hiring-grade analytics on an already-analyzed
 * response, overwriting the stored `analytics` JSONB. Uses the Retell
 * payload already stored on `response.details` — does NOT call back to
 * Retell, so this is idempotent and free of webhook coupling.
 *
 * Auth: protected by Clerk middleware (this route is NOT in `isPublicRoute`).
 *
 * Body: { callId: string }
 *
 * Returns:
 *   200 { analytics, questionsCovered, duration }
 *   400 { error } — missing or invalid input, or stored details are too thin
 *                   to reconstruct a v2 prompt
 *   404 { error } — response not found, or its interview has been deleted
 *   500 { error } — OpenAI failure or other server-side error
 */

import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { countQuestionsCovered } from "@/lib/retellReviewArtifacts";
import { runAnalyticsV2 } from "@/services/analytics.service";
import { InterviewService } from "@/services/interviews.service";
import { ResponseService } from "@/services/responses.service";
import type { Seniority } from "@/types/interview";

export async function POST(req: Request) {
  let body: { callId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const callId = typeof body.callId === "string" ? body.callId.trim() : "";
  if (!callId) {
    return NextResponse.json(
      { error: "Missing `callId` in request body" },
      { status: 400 },
    );
  }

  // ---- Load response ----
  const response = await ResponseService.getResponseByCallId(callId);
  if (!response) {
    return NextResponse.json(
      { error: "Response not found" },
      { status: 404 },
    );
  }

  const details = response.details;
  if (!details || typeof details !== "object") {
    return NextResponse.json(
      {
        error:
          "Response has no stored call details — cannot re-analyze. " +
          "The call may still be in progress or have failed before analysis.",
      },
      { status: 400 },
    );
  }

  // ---- Load interview ----
  const interviewId = response.interview_id;
  if (!interviewId) {
    return NextResponse.json(
      { error: "Response has no associated interview" },
      { status: 400 },
    );
  }

  const interview = await InterviewService.getInterviewById(interviewId);
  if (!interview) {
    return NextResponse.json(
      {
        error:
          "Interview not found — it may have been deleted. Cannot re-analyze without job context.",
      },
      { status: 404 },
    );
  }

  // ---- Build args + run v2 ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const co = details as any;
  const durationSeconds: number =
    typeof response.duration === "number"
      ? response.duration
      : Math.max(
          0,
          Math.round(
            (Number(co.end_timestamp) - Number(co.start_timestamp)) / 1000,
          ),
        );

  // Parse interview.time_duration ("30" or "30 minutes") into seconds.
  const td = interview.time_duration ?? "";
  const tdNumeric = Number(String(td).match(/\d+/)?.[0] ?? "0");
  const expectedDurationSeconds = tdNumeric * 60;

  try {
    const analytics = await runAnalyticsV2({
      roleTitle: interview.name || interview.objective || "the role",
      companyName: "Foloup",
      seniority: ((interview.seniority as Seniority) ?? "mid") as Seniority,
      jobDescription: interview.job_description ?? "",
      mustHaves: Array.isArray(interview.must_haves) ? interview.must_haves : [],
      questions: (interview.questions ?? []).map(
        (q: { question: string; targetDimension?: string; rubricNote?: string }) => ({
          question: q.question,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          targetDimension: q.targetDimension as any,
          rubricNote: q.rubricNote,
        }),
      ),
      expectedDurationSeconds,
      transcriptObject: co.transcript_object ?? null,
      callAnalysis: co.call_analysis ?? null,
      disconnectionReason: co.disconnection_reason ?? null,
      durationSeconds,
    });

    // Recompute questions_covered too — useful when re-analyzing after a
    // transcript correction or when the heuristic itself was updated.
    const questionsCovered = countQuestionsCovered(
      co.transcript_object,
      interview.question_count ?? null,
    );

    await ResponseService.saveResponse(
      {
        analytics,
        is_analysed: true,
        ...(questionsCovered !== null
          ? { questions_covered: questionsCovered }
          : {}),
      } as never,
      callId,
    );

    logger.info("Response re-analyzed via manual trigger", {
      callId,
      questionsCovered,
      overallScore: analytics.overallScore,
      recommendation: analytics.recommendation,
    });

    return NextResponse.json(
      {
        analytics,
        questionsCovered,
        duration: durationSeconds,
      },
      { status: 200 },
    );
  } catch (err) {
    logger.error("Re-analyze failed", {
      callId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Re-analyze failed for an unknown reason",
      },
      { status: 500 },
    );
  }
}
