import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServerBaseUrl } from "@/lib/base-url";
import { logger } from "@/lib/logger";
import { EmailService } from "@/services/email.service";
import { InterviewService } from "@/services/interviews.service";
import { InviteService } from "@/services/invites.service";

/**
 * POST — resend the invite email for an existing pending invite.
 *
 * The dynamic segment is named `[token]` to match the sibling DELETE
 * route, but as with that one, callers pass the invite's row id here.
 *
 * Only `pending` invites can be re-emailed. `reserved` / `used` /
 * `expired` / `revoked` invites are rejected with 409 — re-emailing a
 * consumed or invalid invite would mislead the candidate.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; token: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, token: inviteId } = await params;
  const interview = await InterviewService.getInterviewById(id);
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (interview.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const invites = await InviteService.listInvitesForInterview(interview.id);
    const invite = invites.find((i) => i.id === inviteId);
    if (!invite) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const status = InviteService.deriveInviteStatus(invite);
    if (status !== "pending") {
      return NextResponse.json(
        {
          error: "invite-not-resendable",
          status,
        },
        { status: 409 },
      );
    }

    const baseUrl = getServerBaseUrl(req);
    const candidateSlug = interview.readable_slug ?? interview.id;
    const inviteUrl = `${baseUrl}/call/${candidateSlug}?token=${invite.token}`;

    let recruiterName: string | null = null;
    let recruiterEmail: string | null = null;
    try {
      const user = await currentUser();
      if (user) {
        recruiterName =
          [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
          null;
        recruiterEmail =
          user.emailAddresses.find(
            (a) => a.id === user.primaryEmailAddressId,
          )?.emailAddress ?? null;
      }
    } catch (clerkErr) {
      logger.warn("Could not fetch recruiter context for resend", {
        error:
          clerkErr instanceof Error ? clerkErr.message : String(clerkErr),
      });
    }

    const emailOutcome = await EmailService.sendInviteEmail({
      candidateEmail: invite.email,
      interviewName: interview.name ?? "Interview",
      inviteUrl,
      organizationName: null,
      recruiterName,
      recruiterEmail,
    });

    return NextResponse.json({ email: emailOutcome }, { status: 200 });
  } catch (err) {
    logger.error("resend invite failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
