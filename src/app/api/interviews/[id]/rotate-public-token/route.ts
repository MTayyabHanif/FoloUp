import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { InterviewService } from "@/services/interviews.service";

/**
 * Rotate the public token for an interview, invalidating the previous
 * public link for any NEW session. Existing `ongoing` response rows are
 * unaffected — their session_token is independent of public_token.
 *
 * Authenticated route: only the interview owner can rotate.
 */
export async function POST(
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
    const result = await InterviewService.rotatePublicToken(interview.id);
    logger.info("Rotated public token", {
      interviewId: interview.id,
      userId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    logger.error("rotate-public-token failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
