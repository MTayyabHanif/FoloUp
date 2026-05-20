import { logger } from "@/lib/logger";
import {
  countQuestionsCovered,
  hasRetellReviewArtifacts,
  needsRetellReviewRefresh,
} from "@/lib/retellReviewArtifacts";
import { InterviewService } from "@/services/interviews.service";
import { generateInterviewAnalytics } from "@/services/analytics.service";
import { ResponseService } from "@/services/responses.service";
import type { Response } from "@/types/response";
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
  let analytics = callDetails.analytics;

  if (reviewReady) {
    if (!analytics) {
      const result = await generateInterviewAnalytics({
        callId: body.id,
        interviewId: interviewId,
        transcript: callResponse.transcript,
      });

      analytics = result.analytics;
    }

    const interview = await InterviewService.getInterviewById(interviewId);
    const questionsCovered = countQuestionsCovered(
      callResponse.transcript_object,
      interview?.question_count ?? null,
    );

    await ResponseService.saveResponse(
      {
        details: callResponse,
        is_analysed: true,
        duration: duration,
        analytics,
        ...(questionsCovered !== null
          ? { questions_covered: questionsCovered }
          : {}),
      },
      body.id,
    );

    logger.info("Call analysed successfully");
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
