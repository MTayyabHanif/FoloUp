import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

/**
 * PATCH /api/response-heartbeat
 * Body: { call_id: string, tab_switch_count?: number }
 *
 * Updates last_active_at and (optionally) tab_switch_count on the
 * response row keyed by call_id, but only while status = 'ongoing'.
 * A no-op response (rowCount=0) is normal once the webhook has closed
 * the row — the client does not need to distinguish.
 *
 * Called from the client on visibilitychange → hidden (via
 * navigator.sendBeacon) and on tab-switch.
 */
export async function PATCH(req: NextRequest) {
  let body: { call_id?: string; tab_switch_count?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { call_id, tab_switch_count } = body;
  if (!call_id) {
    return NextResponse.json({ error: "call_id required" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    last_active_at: new Date().toISOString(),
  };
  if (typeof tab_switch_count === "number") {
    payload.tab_switch_count = tab_switch_count;
  }

  const { data, error } = await supabase
    .from("response")
    .update(payload)
    .eq("call_id", call_id)
    .eq("status", "ongoing")
    .select("id");

  if (error) {
    logger.warn("response-heartbeat update failed", { error: error.message });

    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: (data?.length ?? 0) > 0 });
}

/**
 * sendBeacon delivers payloads as POST by default (Content-Type
 * text/plain). Forward to PATCH semantics so the client can use either
 * fetch(PATCH) or sendBeacon(POST) interchangeably.
 */
export async function POST(req: NextRequest) {
  return PATCH(req);
}
