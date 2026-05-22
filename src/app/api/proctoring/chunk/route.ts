import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  extractBearerToken,
  resolveSessionToken,
} from "@/lib/proctoringAuth";
import { getR2BucketName, getR2Client } from "@/lib/r2Client";

export const runtime = "nodejs";

const ALLOWED_STREAMS = new Set(["camera", "screen"]);

/**
 * POST /api/proctoring/chunk
 *
 * Receives one MediaRecorder chunk (webm) and writes it to Cloudflare R2.
 * Auth: Bearer <session_token>. The session_token is unguessable (128-bit
 * UUID minted by /api/register-call). Server resolves the response row,
 * derives the org_id, and ignores any client-sent org claim.
 *
 * Body: multipart/form-data
 *   stream:      "camera" | "screen"
 *   chunk_index: integer (numeric, 0-indexed)
 *   data:        Blob (video/webm)
 *
 * Idempotency: posting the same chunk_index twice overwrites the same R2
 * object. MediaRecorder emits each chunk once via ondataavailable, so
 * retried uploads always contain identical bytes.
 */
export async function POST(req: Request) {
  const token = extractBearerToken(req);
  const ctx = await resolveSessionToken(token);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const stream = form.get("stream");
  const chunkIndexRaw = form.get("chunk_index");
  const data = form.get("data");

  if (typeof stream !== "string" || !ALLOWED_STREAMS.has(stream)) {
    return NextResponse.json({ error: "Invalid stream" }, { status: 400 });
  }
  const chunkIndex =
    typeof chunkIndexRaw === "string" ? parseInt(chunkIndexRaw, 10) : NaN;
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return NextResponse.json(
      { error: "Invalid chunk_index" },
      { status: 400 },
    );
  }
  if (!(data instanceof Blob) || data.size === 0) {
    return NextResponse.json({ error: "Empty chunk" }, { status: 400 });
  }

  const key = `${ctx.organizationId}/${ctx.responseId}/${stream}/${chunkIndex}.webm`;

  try {
    const r2 = getR2Client();
    const bytes = new Uint8Array(await data.arrayBuffer());
    await r2.send(
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: key,
        Body: bytes,
        ContentType: "video/webm",
      }),
    );
  } catch (err) {
    logger.warn("proctoring chunk upload failed", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });

    return NextResponse.json({ error: "upload-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
