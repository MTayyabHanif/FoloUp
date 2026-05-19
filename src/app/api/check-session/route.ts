import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { ResponseService } from "@/services/responses.service";

const RECONNECT_WINDOW_MS = 60_000;

/**
 * GET /api/check-session?token=<uuid>
 *
 * Looks up a response row by `session_token` and reports whether the
 * candidate is allowed to reconnect to it. `withinWindow` is true when:
 *   - the row exists
 *   - status === 'ongoing'
 *   - last_active_at is within RECONNECT_WINDOW_MS (60s)
 *
 * The window is anchored to `last_active_at` (rolling) so heartbeats
 * during an active call keep it fresh; once `call_ended` writes
 * last_active_at = now() it caps the window from disconnect.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  let row;
  try {
    row = await ResponseService.getResponseBySessionToken(token);
  } catch (err) {
    logger.error("check-session lookup failed", { error: (err as Error).message });
    return NextResponse.json(
      { error: "session lookup failed" },
      { status: 500 },
    );
  }

  if (!row) {
    return NextResponse.json({
      exists: false,
      withinWindow: false,
      status: null,
      callId: null,
      responseId: null,
      name: null,
    });
  }

  const lastActiveMs = row.last_active_at
    ? new Date(row.last_active_at).getTime()
    : 0;
  const withinWindow =
    row.status === "ongoing" &&
    lastActiveMs > 0 &&
    Date.now() - lastActiveMs < RECONNECT_WINDOW_MS;

  logger.info("check-session", {
    token,
    status: row.status,
    withinWindow,
  });

  return NextResponse.json({
    exists: true,
    withinWindow,
    status: row.status,
    callId: row.call_id,
    responseId: row.id,
    name: row.name,
  });
}
