import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { InterviewService } from "@/services/interviews.service";
import { InviteService } from "@/services/invites.service";
import type { AccessState, ValidateAccessResponse } from "@/types/invite";

/**
 * Preflight access check for the candidate page.
 *
 * Resolves a single ?token=<uuid> query value (or no token) against an
 * interview and returns one of:
 *   - state: "valid" with optional access_mode + invite_id
 *   - state: "invite-required" | "invite-invalid" | "invite-expired"
 *           | "invite-already-used" | "expired-public"
 *
 * Email is NOT checked here — email-mismatch is enforced exclusively at
 * /api/register-call (ENG1). Owner bypass: if a Clerk session is present
 * and matches interview.user_id, every gate is short-circuited to
 * "valid" with access_mode "owner_bypass" so recruiters can preview their
 * own interviews regardless of invite_only or token expiry.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const interviewId: string | undefined = body.interviewId;
    const token: string | undefined = body.token;

    if (!interviewId) {
      return NextResponse.json(
        { error: "interviewId is required" },
        { status: 400 },
      );
    }

    const interview = await InterviewService.getInterviewById(interviewId);
    if (!interview) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 },
      );
    }

    const { userId } = await auth();
    const isOwner = userId && interview.user_id && userId === interview.user_id;
    if (isOwner) {
      return NextResponse.json<ValidateAccessResponse>({
        state: "valid",
        access_mode: "owner_bypass",
      });
    }

    if (token) {
      const invite = await InviteService.getInviteByToken(
        interview.id,
        token,
      );

      if (invite) {
        if (invite.revoked_at) {
          return respond("invite-invalid");
        }
        if (invite.used_at) {
          return respond("invite-already-used");
        }
        if (new Date(invite.expires_at).getTime() <= Date.now()) {
          return respond("invite-expired");
        }
        if (invite.reserved_at) {
          return respond("invite-already-used");
        }

        return NextResponse.json<ValidateAccessResponse>({
          state: "valid",
          access_mode: "invite",
          invite_id: invite.id,
        });
      }

      if (
        interview.public_token &&
        token === interview.public_token &&
        !interview.invite_only
      ) {
        const expiresAt = interview.public_token_expires_at
          ? new Date(interview.public_token_expires_at).getTime()
          : 0;
        if (expiresAt <= Date.now()) {
          return respond("expired-public");
        }

        return NextResponse.json<ValidateAccessResponse>({
          state: "valid",
          access_mode: "public",
        });
      }

      return respond("invite-invalid");
    }

    if (interview.invite_only) {
      return respond("invite-required");
    }

    const expiresAt = interview.public_token_expires_at
      ? new Date(interview.public_token_expires_at).getTime()
      : 0;
    if (expiresAt <= Date.now()) {
      return respond("expired-public");
    }

    return NextResponse.json<ValidateAccessResponse>({
      state: "valid",
      access_mode: "public",
    });
  } catch (err) {
    logger.error("validate-access failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

const respond = (state: AccessState) =>
  NextResponse.json<ValidateAccessResponse>({ state });
