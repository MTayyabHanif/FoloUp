import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { InterviewerService } from "@/services/interviewers.service";

// Soft-delete an interviewer. Idempotent — re-deleting an already-deleted
// row overwrites `deleted_at` and returns 200. Returns 404 only when no row
// with the given id exists at all. Intentionally does NOT call any Retell
// deletion API; the agent and LLM resources are left in Retell as an
// accepted v1 leak (documented in design.md).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json(
      { error: "`id` must be a positive integer" },
      { status: 400 },
    );
  }

  logger.info(`DELETE /api/interviewers/${id} request received`);

  try {
    const affected = await InterviewerService.deleteInterviewer(id);
    if (affected.length === 0) {
      return NextResponse.json(
        { error: "Interviewer not found" },
        { status: 404 },
      );
    }
    
return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logger.error(`DELETE /api/interviewers/${id} failed:`, error as object);
    const details = error instanceof Error ? error.message : String(error);
    
return NextResponse.json(
      {
        error: "Failed to delete interviewer",
        ...(process.env.NODE_ENV !== "production" && { details }),
      },
      { status: 500 },
    );
  }
}
