import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  extractBearerToken,
  resolveSessionToken,
} from "@/lib/proctoringAuth";
import { getR2BucketName, getR2Client } from "@/lib/r2Client";

export const runtime = "nodejs";

const ALLOWED_STREAMS = new Set(["camera", "screen"]);
const PUT_URL_TTL_SECONDS = 300; // 5 min

/**
 * POST /api/proctoring/upload-url
 *
 * Mints a short-lived presigned PUT URL so the candidate browser can
 * upload chunk bytes DIRECTLY to R2 (bypassing the Vercel function).
 *
 * Why this exists: Vercel serverless functions hold the connection open
 * for the entire duration of body upload. With ~500KB chunks on a
 * residential uplink and Chrome's 6-connection-per-origin limit, the
 * old POST-to-vercel chunk route bottlenecks under typical interview
 * load — requests stack up as "pending" and never complete. Presigned
 * URLs sidestep this entirely; the function call here is ~50ms (no
 * body bytes), and the candidate uploads bytes straight to Cloudflare
 * R2.
 *
 * Auth: Bearer <session_token>. Server derives org_id via the response
 * → interview join; client never sends org_id.
 *
 * Body: { stream: "camera" | "screen", chunk_index: number }
 * Returns: { url: string, key: string }
 *
 * The presigned URL expires in 5 minutes (PUT_URL_TTL_SECONDS). The
 * client must include Content-Type: video/webm on the PUT request to
 * match what was signed.
 */
export async function POST(req: Request) {
  const token = extractBearerToken(req);
  const ctx = await resolveSessionToken(token);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { stream?: unknown; chunk_index?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const stream = body.stream;
  if (typeof stream !== "string" || !ALLOWED_STREAMS.has(stream)) {
    return NextResponse.json({ error: "Invalid stream" }, { status: 400 });
  }
  const chunkIndex =
    typeof body.chunk_index === "number"
      ? body.chunk_index
      : typeof body.chunk_index === "string"
        ? parseInt(body.chunk_index, 10)
        : NaN;
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json(
      { error: "Invalid chunk_index" },
      { status: 400 },
    );
  }

  const key = `${ctx.organizationId}/${ctx.responseId}/${stream}/${chunkIndex}.webm`;

  try {
    const r2 = getR2Client();
    const cmd = new PutObjectCommand({
      Bucket: getR2BucketName(),
      Key: key,
      ContentType: "video/webm",
    });
    const url = await getSignedUrl(r2, cmd, {
      expiresIn: PUT_URL_TTL_SECONDS,
    });

    return NextResponse.json({ url, key });
  } catch (err) {
    logger.warn("proctoring upload-url signing failed", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: "sign-failed" }, { status: 500 });
  }
}
