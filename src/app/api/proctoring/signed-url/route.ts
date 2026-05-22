import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { getR2BucketName, getR2Client } from "@/lib/r2Client";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const ALLOWED_STREAMS = new Set(["camera", "screen"]);
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * GET /api/proctoring/signed-url
 *
 * Recruiter-facing. Returns a short-lived signed URL for either:
 *   - the manifest JSON (when no chunk_index is provided)
 *   - a specific chunk (when chunk_index is provided)
 *
 * Auth: Clerk session. Org-ownership enforced by checking
 *   interview.user_id === auth().userId
 * — matching the existing pattern in
 *   src/app/api/interviews/[id]/invites/route.ts.
 * Returns 403 on mismatch.
 *
 * Query params:
 *   response_id  required (number)
 *   stream       required ("camera" | "screen")
 *   chunk_index  optional (integer)
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const responseIdRaw = url.searchParams.get("response_id");
  const stream = url.searchParams.get("stream");
  const chunkIndexRaw = url.searchParams.get("chunk_index");

  const responseId = responseIdRaw ? parseInt(responseIdRaw, 10) : NaN;
  if (!Number.isInteger(responseId) || responseId <= 0) {
    return NextResponse.json(
      { error: "Invalid response_id" },
      { status: 400 },
    );
  }
  if (!stream || !ALLOWED_STREAMS.has(stream)) {
    return NextResponse.json({ error: "Invalid stream" }, { status: 400 });
  }

  let chunkIndex: number | null = null;
  if (chunkIndexRaw !== null) {
    chunkIndex = parseInt(chunkIndexRaw, 10);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json(
        { error: "Invalid chunk_index" },
        { status: 400 },
      );
    }
  }

  const supabase = getSupabaseServiceClient();

  const { data: response, error: respError } = await supabase
    .from("response")
    .select(
      "id, interview_id, camera_storage_path, screen_storage_path, interview:interview_id(user_id, organization_id)",
    )
    .eq("id", responseId)
    .maybeSingle();

  if (respError || !response) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const interview = (
    Array.isArray(response.interview)
      ? response.interview[0]
      : response.interview
  ) as { user_id: string | null; organization_id: string | null } | null;

  if (!interview || interview.user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let key: string | null = null;
  if (chunkIndex !== null) {
    if (!interview.organization_id) {
      return NextResponse.json({ error: "Missing org" }, { status: 404 });
    }
    key = `${interview.organization_id}/${responseId}/${stream}/${chunkIndex}.webm`;
  } else {
    key =
      stream === "camera"
        ? response.camera_storage_path
        : response.screen_storage_path;
  }

  if (!key) {
    return NextResponse.json({ error: "Not finalized" }, { status: 404 });
  }

  try {
    const r2 = getR2Client();
    const signed = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: getR2BucketName(), Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );

    return NextResponse.json({ url: signed, path: key });
  } catch (err) {
    logger.warn("proctoring signed-url failed", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: "sign-failed" }, { status: 500 });
  }
}
