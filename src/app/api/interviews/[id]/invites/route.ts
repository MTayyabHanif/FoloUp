import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { InterviewService } from "@/services/interviews.service";
import { InviteService } from "@/services/invites.service";

/**
 * GET — list invites for an interview (recruiter view).
 * POST — create a new invite for a candidate email.
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

  try {
    const invite = await InviteService.createInvite(interview.id, email);

    return NextResponse.json(
      {
        invite: {
          ...invite,
          status: InviteService.deriveInviteStatus(invite),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    logger.error("create invite failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
