import { NextRequest, NextResponse } from "next/server";
import Retell from "retell-sdk";

import { logger } from "@/lib/logger";
import { countQuestionsCovered, needsRetellReviewRefresh } from "@/lib/retellReviewArtifacts";
import { runAnalyticsV2 } from "@/services/analytics.service";
import { InterviewService } from "@/services/interviews.service";
import { InviteService } from "@/services/invites.service";
import { ResponseService } from "@/services/responses.service";
import type { Seniority } from "@/types/interview";
import type { AnalyticsV2, ResponseStatus } from "@/types/response";

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
 * Map Retell's `disconnection_reason` to our 4-value status enum.
 *
 * `user_hangup` under 30s is treated as `interrupted` (the candidate
 * probably bailed early), 30s+ as `completed` (they finished the
 * substantive part of the call). Everything starting with `error_*`
 * is `interrupted`. `registered_call_timeout` (candidate clicked the
 * link but never started) is `abandoned`.
 */
function mapDisconnectionReason(
  reason: string | null | undefined,
  durationSec: number,
): ResponseStatus {
  if (!reason) {return "interrupted";}

  switch (reason) {
    case "agent_hangup":
    case "max_duration_reached":
    case "inactivity":
      return "completed";
    case "user_hangup":
      return durationSec >= 30 ? "completed" : "interrupted";
    case "registered_call_timeout":
    case "error_user_not_joined":
      return "abandoned";
    default:
      // All other reasons (error_*, concurrency_limit_reached,
      // scam_detected, dial_*, voicemail_reached, machine_detected,
      // no_valid_payment, call_transfer, error_unknown, ...) are
      // treated as interrupted.
      return "interrupted";
  }
}

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
      // Strong signal: the candidate's call actually connected. Mark the
      // associated invite as used (if there is one). markInviteUsed is
      // a silent no-op when response.invite_id is null (public-link or
      // legacy flow) and never throws, so this is safe to await without
      // a try/catch beyond what InviteService already does internally.
      await InviteService.markInviteUsed(call.call_id);
      break;

    case "call_ended": {
      logger.info("Call ended", { callId: call.call_id });

      // Retrieve the full call object from Retell to get the
      // disconnection_reason and accurate duration. This adds ~100-500ms
      // to webhook turnaround but unblocks immediate dashboard status —
      // the alternative (waiting for call_analyzed) lags by 30-120s.
      const callOutput = await retell.call.retrieve(call.call_id);
      const durationSec = Math.max(
        0,
        Math.round(
          (Number(callOutput.end_timestamp) -
            Number(callOutput.start_timestamp)) /
            1000,
        ),
      );

      const status = mapDisconnectionReason(
        callOutput.disconnection_reason as string | undefined,
        durationSec,
      );

      // Single atomic conditional UPDATE — the .eq('status','ongoing')
      // clause is the entire idempotency guard. On webhook retries the
      // second delivery is a rowCount=0 no-op rather than a clobber.
      const { updated } = await ResponseService.saveResponseConditional(
        {
          status,
          disconnection_reason:
            (callOutput.disconnection_reason as string | undefined) ?? null,
          is_ended: status === "completed",
          last_active_at: new Date().toISOString(),
          duration: durationSec,
        } as never,
        call.call_id,
        { column: "status", value: "ongoing" },
      );

      if (updated) {
        logger.info("call_ended: closed row", {
          callId: call.call_id,
          status,
          reason: callOutput.disconnection_reason,
        });
      } else {
        logger.info("call_ended: no-op (row already closed)", {
          callId: call.call_id,
        });
      }

      break;
    }

    case "call_analyzed": {
      const stored = await ResponseService.getResponseByCallId(call.call_id);
      if (!needsRetellReviewRefresh(stored)) {
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

      const interview = await InterviewService.getInterviewById(
        stored.interview_id,
      );

      // questions_covered = count of substantive user turns
      // (filters filler words like "yeah", "um" via 20-char threshold),
      // capped at the interview's declared question_count.
      let questionsCovered: number | null = null;
      try {
        const transcriptObject = (callOutput as { transcript_object?: unknown })
          .transcript_object as Array<{ role: string; content?: string }> | undefined;
        questionsCovered = countQuestionsCovered(
          transcriptObject,
          interview?.question_count ?? null,
        );
      } catch (err) {
        logger.warn("questions_covered computation failed", {
          callId: call.call_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Parse interview.time_duration (string like "30" or "30 minutes") into seconds.
      const td = interview?.time_duration ?? "";
      const tdNumeric = Number(String(td).match(/\d+/)?.[0] ?? "0");
      const expectedDurationSeconds = tdNumeric * 60;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const co = callOutput as any;

      let analytics: AnalyticsV2 | null = null;
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
        logger.error("Analytics generation failed", {
          callId: call.call_id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue to persist call details + questionsCovered even if scoring
        // failed — recruiters can re-trigger analysis later. The row's
        // `analytics` column will be set on a subsequent successful run.
      }

      await ResponseService.saveResponse(
        {
          details: callOutput,
          is_analysed: analytics !== null,
          duration,
          ...(analytics !== null ? { analytics } : {}),
          ...(questionsCovered !== null
            ? { questions_covered: questionsCovered }
            : {}),
        } as never,
        call.call_id,
      );

      logger.info("Call analysed via webhook", {
        callId: call.call_id,
        questionsCovered,
        analyticsGenerated: analytics !== null,
      });
      break;
    }

    default:
      logger.info("Unknown Retell webhook event", { event });
  }

  // Acknowledge receipt (Retell expects 2xx).
  return NextResponse.json({ ok: true }, { status: 200 });
}
