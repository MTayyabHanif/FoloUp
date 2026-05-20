import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServerBaseUrl } from "@/lib/base-url";
import { logger } from "@/lib/logger";
import { EmailService } from "@/services/email.service";
import { InterviewService } from "@/services/interviews.service";
import { InviteService } from "@/services/invites.service";

/**
 * GET — list invites for an interview (recruiter view).
 * POST — create a new invite for a candidate email and email the candidate
 *        via Resend. The email send is best-effort: if Resend isn't
 *        configured or send fails, the invite row is still created and
 *        the recruiter can copy the link manually from the dashboard.
 *
 * Both require Clerk auth and the requester must own the interview.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const interview = await InterviewService.getInterviewById(id);
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (interview.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const invites = await InviteService.listInvitesForInterview(interview.id);
    const enriched = invites.map((inv) => ({
      ...inv,
      status: InviteService.deriveInviteStatus(inv),
    }));

    return NextResponse.json({ invites: enriched }, { status: 200 });
  } catch (err) {
    logger.error("list invites failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const interview = await InterviewService.getInterviewById(id);
  if (!interview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (interview.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const email: string | undefined = body.email;
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );
  }

  // The invite row is the source of truth. If creation succeeds but the
  // email send (or anything else after) throws, we still want the
  // recruiter to have an invite they can copy manually. So we split the
  // creation step from the post-creation work, and only return 500 if
  // the DB write itself fails.
  let invite;
  try {
    invite = await InviteService.createInvite(interview.id, email);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logger.error("create invite — DB write failed", {
      interviewId: interview.id,
      email,
      message,
      stack,
    });

    return NextResponse.json(
      {
        error: "create-invite-failed",
        detail: message,
      },
      { status: 500 },
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
    logger.warn("Could not fetch recruiter context for invite email", {
      error:
        clerkErr instanceof Error ? clerkErr.message : String(clerkErr),
    });
  }

  let emailOutcome;
  try {
    emailOutcome = await EmailService.sendInviteEmail({
      candidateEmail: invite.email,
      interviewName: interview.name ?? "Interview",
      inviteUrl,
      organizationName: null,
      recruiterName,
      recruiterEmail,
    });
  } catch (emailErr) {
    // Defensive — EmailService.sendInviteEmail already catches internally
    // and returns an outcome. This is a belt-and-suspenders log in case
    // something escapes (e.g., a future SDK migration regression).
    const message =
      emailErr instanceof Error ? emailErr.message : String(emailErr);
    logger.error("sendInviteEmail escaped its try/catch", {
      interviewId: interview.id,
      email,
      message,
      stack: emailErr instanceof Error ? emailErr.stack : undefined,
    });
    emailOutcome = {
      ok: false as const,
      reason: "send-failed" as const,
      detail: message,
    };
  }

  return NextResponse.json(
    {
      invite: {
        ...invite,
        status: InviteService.deriveInviteStatus(invite),
      },
      email: emailOutcome,
    },
    { status: 201 },
  );
}
