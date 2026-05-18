import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";

import { logger } from "@/lib/logger";
import { generateInterviewAnalytics } from "@/services/analytics.service";
import { ResponseService } from "@/services/responses.service";

const apiKey = process.env.RETELL_API_KEY || "";

const retell = new Retell({ apiKey });

type RetellCall = {
  call_id: string;
  start_timestamp: number;
  end_timestamp: number;
  transcript: string;
  [k: string]: unknown;
};

type WebhookPayload = {
  event: "call_started" | "call_ended" | "call_analyzed" | string;
  call: RetellCall;
};

/**
 * Retell webhook receiver.
 *
 * Audit-driven fixes (change #3 wave 1):
 * - Route is now in middleware `isPublicRoute` so Retell can reach it without
 *   Clerk auth — request body verification is the actual gate.
 * - Reads raw body via `req.text()` before signature verify. The previous
 *   `JSON.stringify(req.body)` stringified the stream's `ReadableStream` reference
 *   (effectively `"{}"` or `undefined`), so the HMAC NEVER matched and every
 *   Retell callback returned 401. Fixed.
 * - On `call_analyzed`, calls `generateInterviewAnalytics` + `ResponseService`
 *   in-process instead of `axios.post("/api/get-call", ...)`. The relative URL
 *   was broken in server context, and even if absolute, it added a network hop
 *   and a Clerk-auth crossing for no benefit.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (
    !Retell.verify(
      rawBody,
      apiKey,
      req.headers.get("x-retell-signature") as string,
    )
  ) {
    logger.warn("Invalid Retell webhook signature");

    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { event, call } = JSON.parse(rawBody) as WebhookPayload;

  switch (event) {
    case "call_started":
      logger.info("Call started", { callId: call.call_id });
      break;

    case "call_ended":
      logger.info("Call ended", { callId: call.call_id });
      break;

    case "call_analyzed": {
      const stored = await ResponseService.getResponseByCallId(call.call_id);
      if (stored?.is_analysed) {
        logger.info("Call already analysed; skipping", {
          callId: call.call_id,
        });
        break;
      }

      const callOutput = await retell.call.retrieve(call.call_id);
      const duration = Math.round(
        Number(callOutput.end_timestamp) / 1000 -
          Number(callOutput.start_timestamp) / 1000,
      );

      const result = await generateInterviewAnalytics({
        callId: call.call_id,
        interviewId: stored.interview_id,
        transcript: callOutput.transcript ?? "",
      });

      await ResponseService.saveResponse(
        {
          details: callOutput,
          is_analysed: true,
          duration,
          analytics: result.analytics,
        },
        call.call_id,
      );

      logger.info("Call analysed via webhook", { callId: call.call_id });
      break;
    }

    default:
      logger.info("Unknown Retell webhook event", { event });
  }

  // Acknowledge receipt (Retell expects 2xx).
  return NextResponse.json({ ok: true }, { status: 200 });
}
