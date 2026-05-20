import { randomUUID } from "crypto";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Retell from "retell-sdk";

import { logger } from "@/lib/logger";
import { InterviewService } from "@/services/interviews.service";
import { InterviewerService } from "@/services/interviewers.service";
import { InviteService } from "@/services/invites.service";

const retellClient = new Retell({
  apiKey: process.env.RETELL_API_KEY || "",
});

/**
 * Mint a Retell web-call + session token.
 *
 * Token gate (added with the tokenized-invites-and-rotating-public-links
 * change):
 * - Reads `interviewId`, `inviteToken`, and `candidateEmail` from the body.
 * - Owner bypass: if the authenticated Clerk user owns the interview, all
 *   gates are skipped (matches /api/validate-access semantics).
 * - If invite_only=true and no token: 403 invite-required.
 * - If inviteToken matches a row in interview_invites: validate (not
 *   revoked / not used / not expired), reserve atomically, then enforce
 *   email binding (ENG1: email-mismatch is enforced ONLY here, not in
 *   validate-access). 409 if already reserved; 403 on mismatch.
 * - If inviteToken matches interview.public_token (and not invite_only),
 *   validate expiry and proceed with invite_id=null.
 * - If a token is supplied but matches neither: 403 invite-invalid.
 *
 * Returns `invite_id` in the response so the client can persist it on the
 * response row (INVITE_ID_THREADING_ATOMIC step 1).
 */
export async function POST(req: Request) {
  logger.info("register-call request received");

  const body = await req.json();
  const interviewerId = body.interviewer_id;
  const interviewId: string | undefined = body.interview_id;
  const inviteToken: string | undefined = body.invite_token;
  const candidateEmail: string | undefined = body.candidate_email;

  let inviteId: string | null = null;

  if (interviewId) {
    const interview = await InterviewService.getInterviewById(interviewId);
    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }

    const { userId } = await auth();
    const isOwner =
      userId && interview.user_id && userId === interview.user_id;

    if (!isOwner) {
      if (interview.invite_only && !inviteToken) {
        return NextResponse.json(
          { error: "invite-required" },
          { status: 403 },
        );
      }

      if (inviteToken) {
        const invite = await InviteService.getInviteByToken(
          interview.id,
          inviteToken,
        );

        if (invite) {
          if (invite.revoked_at) {
            return NextResponse.json(
              { error: "invite-invalid" },
              { status: 403 },
            );
          }
          if (invite.used_at) {
            return NextResponse.json(
              { error: "invite-already-used" },
              { status: 403 },
            );
          }
          if (new Date(invite.expires_at).getTime() <= Date.now()) {
            return NextResponse.json(
              { error: "invite-expired" },
              { status: 403 },
            );
          }

          const reserved = await InviteService.markInviteReserved(invite.id);
          if (!reserved.ok) {
            return NextResponse.json(
              { error: "invite-already-used" },
              { status: 409 },
            );
          }

          if (
            !candidateEmail ||
            invite.email.toLowerCase().trim() !==
              candidateEmail.toLowerCase().trim()
          ) {
            return NextResponse.json(
              { error: "invite-email-mismatch" },
              { status: 403 },
            );
          }

          inviteId = invite.id;
        } else if (
          interview.public_token &&
          inviteToken === interview.public_token &&
          !interview.invite_only
        ) {
          const expiresAt = interview.public_token_expires_at
            ? new Date(interview.public_token_expires_at).getTime()
            : 0;
          if (expiresAt <= Date.now()) {
            return NextResponse.json(
              { error: "expired-public" },
              { status: 403 },
            );
          }
        } else {
          return NextResponse.json(
            { error: "invite-invalid" },
            { status: 403 },
          );
        }
      } else if (!interview.invite_only) {
        const expiresAt = interview.public_token_expires_at
          ? new Date(interview.public_token_expires_at).getTime()
          : 0;
        if (expiresAt <= Date.now()) {
          return NextResponse.json(
            { error: "expired-public" },
            { status: 403 },
          );
        }
      }
    }
  }

  const interviewer = await InterviewerService.getInterviewer(interviewerId);
  if (!interviewer) {
    logger.info(`register-call: interviewer ${interviewerId} not found`);

    return NextResponse.json(
      { error: "Interviewer not found" },
      { status: 404 },
    );
  }

  const registerCallResponse = await retellClient.call.createWebCall({
    agent_id: interviewer.agent_id,
    retell_llm_dynamic_variables: body.dynamic_data,
  });

  const sessionToken = randomUUID();

  logger.info("Call registered successfully", { inviteId });

  return NextResponse.json(
    {
      registerCallResponse,
      session_token: sessionToken,
      invite_id: inviteId,
    },
    { status: 200 },
  );
}
