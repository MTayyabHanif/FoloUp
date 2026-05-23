import { logger } from "@/lib/logger";
import {
  countQuestionsCovered,
  hasRetellReviewArtifacts,
  needsRetellReviewRefresh,
} from "@/lib/retellReviewArtifacts";
import { InterviewService } from "@/services/interviews.service";
import { runAnalyticsV2 } from "@/services/analytics.service";
import { ResponseService } from "@/services/responses.service";
import type { Seniority } from "@/types/interview";
import type { AnalyticsV2, Response } from "@/types/response";
import { NextResponse } from "next/server";
import Retell from "retell-sdk";

const retell = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

export async function POST(req: Request) {
  logger.info("get-call request received");
  const body = await req.json();

  const callDetails: Response = await ResponseService.getResponseByCallId(body.id);
  let callResponse = callDetails.details;

  if (!needsRetellReviewRefresh(callDetails)) {
    return NextResponse.json(
      {
        callResponse,
        analytics: callDetails.analytics,
      },
      { status: 200 },
    );
  }
  const callOutput = await retell.call.retrieve(body.id);
  const interviewId = callDetails?.interview_id;
  callResponse = callOutput;
  const duration = Math.round(
    callResponse.end_timestamp / 1000 - callResponse.start_timestamp / 1000,
  );
  const reviewReady = hasRetellReviewArtifacts(callResponse);
  let analytics: AnalyticsV2 | null = callDetails.analytics ?? null;

  if (reviewReady) {
    const interview = await InterviewService.getInterviewById(interviewId);

    if (!analytics) {
      // Parse interview.time_duration (string like "30" or "30 minutes") into seconds.
      const td = interview?.time_duration ?? "";
      const tdNumeric = Number(String(td).match(/\d+/)?.[0] ?? "0");
      const expectedDurationSeconds = tdNumeric * 60;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const co = callResponse as any;
      try {
        analytics = await runAnalyticsV2({
          roleTitle: interview?.name || interview?.objective || "the role",
          companyName: "Robust Devs",
          seniority: (interview?.seniority as Seniority) ?? "mid",
          jobDescription: interview?.job_description ?? "",
          mustHaves: Array.isArray(interview?.must_haves)
            ? interview.must_haves
            : [],
          questions: (interview?.questions ?? []).map(
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
          durationSeconds: duration,
        });
      } catch (err) {
        logger.error("Analytics generation failed in get-call", {
          callId: body.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const questionsCovered = countQuestionsCovered(
      callResponse.transcript_object,
      interview?.question_count ?? null,
    );

    await ResponseService.saveResponse(
      {
        details: callResponse,
        is_analysed: analytics !== null,
        duration: duration,
        ...(analytics !== null ? { analytics } : {}),
        ...(questionsCovered !== null
          ? { questions_covered: questionsCovered }
          : {}),
      },
      body.id,
    );

    logger.info("Call analysed successfully", {
      callId: body.id,
      analyticsGenerated: analytics !== null,
    });
  } else {
    await ResponseService.saveResponse(
      {
        details: callResponse,
        duration: duration,
      },
      body.id,
    );

    logger.info("Call not ready for analysis; returning partial Retell payload", {
      callId: body.id,
    });
  }

  return NextResponse.json(
    {
      callResponse,
      analytics,
    },
    { status: 200 },
  );
}
