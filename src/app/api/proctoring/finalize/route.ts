import {
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  extractBearerToken,
  resolveSessionToken,
} from "@/lib/proctoringAuth";
import { getR2BucketName, getR2Client } from "@/lib/r2Client";
import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const ALLOWED_STREAMS = new Set(["camera", "screen"]);

/**
 * POST /api/proctoring/finalize
 *
 * For each requested stream, lists all chunk objects in
 * <org>/<response_id>/<stream>/, sorts by NUMERIC chunk_index (parseInt,
 * not lexicographic — "10.webm" < "2.webm" lexicographically), and writes
 * a manifest.json describing the chunk list. Does NOT concatenate chunks
 * (avoids exceeding Vercel Hobby's 10s function timeout — finalize runs
 * in ~2s: list + single JSON write).
 *
 * Chunks remain in R2 and are the playable artifacts. Recruiter player
 * reads the manifest and uses MediaSource Extensions (or sequential
 * playback fallback) to stitch chunks client-side via per-chunk signed URLs.
 *
 * Body: { streams: ("camera" | "screen")[] }
 * Auth: Bearer <session_token>.
 */
export async function POST(req: Request) {
  const token = extractBearerToken(req);
  const ctx = await resolveSessionToken(token);
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { streams?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const streams = Array.isArray(body.streams)
    ? body.streams.filter(
        (s): s is "camera" | "screen" =>
          typeof s === "string" && ALLOWED_STREAMS.has(s),
      )
    : [];
  if (streams.length === 0) {
    return NextResponse.json({ error: "No streams" }, { status: 400 });
  }

  const r2 = getR2Client();
  const bucket = getR2BucketName();
  const paths: { camera?: string; screen?: string } = {};
  const updatePayload: Record<string, string> = {};

  for (const stream of streams) {
    const prefix = `${ctx.organizationId}/${ctx.responseId}/${stream}/`;
    let listed: ListObjectsV2CommandOutput;
    try {
      listed = await r2.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: 1000,
        }),
      );
    } catch (err) {
      logger.warn("proctoring finalize list failed", {
        prefix,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    const objects = listed.Contents ?? [];
    if (objects.length === 0) {
      logger.info("proctoring finalize: no chunks present", { prefix });
      continue;
    }

    // Numeric sort by chunk index. Lexicographic sort would put "10.webm"
    // before "2.webm" — explicitly use parseInt.
    const chunks = objects
      .filter((o) => o.Key?.endsWith(".webm"))
      .map((o) => {
        const name = o.Key!.slice(prefix.length); // e.g. "0.webm"
        const index = parseInt(name.replace(/\.webm$/, ""), 10);

        return { index, path: o.Key!, name };
      })
      .filter((c) => Number.isFinite(c.index))
      .sort((a, b) => a.index - b.index)
      .map(({ index, path }) => ({ index, path }));

    const manifest = {
      stream,
      chunks,
      mimeType: "video/webm;codecs=vp8",
      createdAt: new Date().toISOString(),
    };
    const manifestKey = `${ctx.organizationId}/${ctx.responseId}/${stream}.manifest.json`;

    try {
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: manifestKey,
          Body: JSON.stringify(manifest),
          ContentType: "application/json",
        }),
      );
    } catch (err) {
      logger.warn("proctoring finalize manifest upload failed", {
        manifestKey,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    paths[stream] = manifestKey;
    if (stream === "camera") updatePayload.camera_storage_path = manifestKey;
    if (stream === "screen") updatePayload.screen_storage_path = manifestKey;
  }

  if (Object.keys(updatePayload).length > 0) {
    const supabase = getSupabaseServiceClient();
    const { error: updateError } = await supabase
      .from("response")
      .update(updatePayload)
      .eq("id", ctx.responseId);
    if (updateError) {
      logger.warn("proctoring finalize response update failed", {
        error: updateError.message,
      });
    }
  }

  return NextResponse.json({ ok: true, paths });
}
