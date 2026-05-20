import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { InterviewService } from "@/services/interviews.service";
import { InviteService } from "@/services/invites.service";

/**
 * DELETE — revoke an invite. The dynamic segment is named `[token]` to
 * match the dashboard URL pattern (recruiters reference invites by their
 * token, not their internal id), but we resolve via the invite_id column.
 * Callers MUST pass the invite's row id here, not the candidate-facing
 * token — that's what the list endpoint returns and what the UI holds.
 */
export async function DELETE(
  _req: Request,
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
    await InviteService.revokeInvite(inviteId);
    logger.info("Revoked invite", { interviewId: interview.id, inviteId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    logger.error("revoke invite failed", {
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
