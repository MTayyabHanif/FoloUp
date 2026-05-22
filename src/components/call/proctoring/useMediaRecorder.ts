"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProctoringStreamType = "camera" | "screen";

// Chunk timeslice — how often MediaRecorder emits an ondataavailable
// event. Smaller = more chunks land in R2 sooner, so an unexpected end
// (agent hangup, browser crash, tab close) loses less recording. Trade
// is more HTTP requests overall. 3s is the sweet spot for a 30-min
// interview: ~600 chunks per stream, each chunk ~250-500KB at typical
// screen-capture bitrates — small enough to upload in <1s on broadband.
const TIMESLICE_MS = 3_000;
const MAX_RETRIES = 3;
const STOP_TIMEOUT_MS = 30_000;

/**
 * Try several MediaRecorder configurations in order until one constructs
 * AND starts successfully. Real-world browsers diverge:
 *  - Chrome on macOS prefers vp9 for screen capture at high res; vp8 at
 *    500kbps throws NotSupportedError on `.start()` when the encoder
 *    can't produce a keyframe at that target bitrate.
 *  - Safari (Tech Preview) supports h264 in mp4 only; webm is unsupported.
 *  - Firefox supports vp8 reliably but vp9 only since 89.
 * Returns the live recorder on success, null if every option failed.
 */
function describeStream(stream: MediaStream): string {
  const tracks = stream.getTracks().map((t) => {
    const s = (t.getSettings?.() ?? {}) as Record<string, unknown>;

    return `${t.kind}(${(s.width as number) ?? "?"}x${(s.height as number) ?? "?"} ${(s.frameRate as number) ?? "?"}fps surface=${s.displaySurface ?? "n/a"})`;
  });

  return tracks.join(", ");
}

function tryStartRecorder(
  stream: MediaStream,
  timeslice: number,
  streamLabel: string,
): MediaRecorder | null {
  if (typeof MediaRecorder === "undefined") {
    console.warn(
      `[proctoring/${streamLabel}] MediaRecorder API unavailable in this browser`,
    );

    return null;
  }

  const options: MediaRecorderOptions[] = [
    { mimeType: "video/webm;codecs=vp9" },
    { mimeType: "video/webm;codecs=vp8" },
    { mimeType: "video/webm" },
    { mimeType: "video/mp4" }, // Safari
    {}, // Browser default
  ];

  const rejected: string[] = [];
  for (const opts of options) {
    const label = opts.mimeType ?? "(default)";
    if (
      opts.mimeType &&
      typeof MediaRecorder.isTypeSupported === "function" &&
      !MediaRecorder.isTypeSupported(opts.mimeType)
    ) {
      rejected.push(`${label}: isTypeSupported=false`);
      continue;
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, opts);
    } catch (err) {
      rejected.push(
        `${label}: construct threw ${err instanceof Error ? err.name + " " + err.message : String(err)}`,
      );
      continue;
    }
    try {
      recorder.start(timeslice);
      console.info(
        `[proctoring/${streamLabel}] MediaRecorder started with ${label}, stream=${describeStream(stream)}`,
      );

      return recorder;
    } catch (err) {
      rejected.push(
        `${label}: start() threw ${err instanceof Error ? err.name + " " + err.message : String(err)}`,
      );
      try {
        recorder.stop();
      } catch {
        /* noop */
      }
    }
  }

  console.error(
    `[proctoring/${streamLabel}] ALL MediaRecorder configurations failed. stream=${describeStream(stream)}. Rejections:\n  ${rejected.join("\n  ")}`,
  );

  return null;
}

async function postChunk(
  sessionToken: string,
  streamType: ProctoringStreamType,
  chunkIndex: number,
  blob: Blob,
): Promise<void> {
  const form = new FormData();
  form.append("stream", streamType);
  form.append("chunk_index", String(chunkIndex));
  form.append("data", blob, `${chunkIndex}.webm`);

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetch("/api/proctoring/chunk", {
        method: "POST",
        body: form,
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) return;
      lastError = new Error(`chunk POST ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    // Exponential backoff: 250ms, 750ms, 1750ms
    const delay = 250 * (1 + 2 * attempt);
    await new Promise((r) => setTimeout(r, delay));
  }
  // After max retries, give up silently — finalize will simply omit this
  // chunk from the manifest. We log to console for client-side debugging.
  console.warn(
    "[proctoring] chunk upload abandoned after retries",
    streamType,
    chunkIndex,
    lastError,
  );
}

export type UseMediaRecorderArgs = {
  stream: MediaStream | null;
  streamType: ProctoringStreamType;
  sessionToken: string | null;
  enabled: boolean;
};

export type UseMediaRecorderApi = {
  start: () => void;
  stop: () => Promise<void>;
  isInterrupted: boolean;
  /**
   * The mimeType the MediaRecorder actually chose from the fallback chain
   * (vp9 → vp8 → webm → mp4 → default). Null before start, or if start
   * failed. Used by Call to send the correct codec to the finalize route
   * so the manifest doesn't lie about what's in the chunks.
   */
  mimeType: string | null;
};

/**
 * Wraps MediaRecorder + chunked upload to /api/proctoring/chunk.
 *
 * - timeslice 10s; chunks POST'd immediately
 * - retry with exponential backoff (3 attempts)
 * - stop() awaits all in-flight uploads (Promise.allSettled) with a 30s
 *   hard timeout so a stuck upload doesn't block call-end UI indefinitely
 * - isInterrupted flips true on any MediaStreamTrack `ended` event
 */
export function useMediaRecorder({
  stream,
  streamType,
  sessionToken,
  enabled,
}: UseMediaRecorderArgs): UseMediaRecorderApi {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunkIndexRef = useRef(0);
  const pendingUploadsRef = useRef<Set<Promise<void>>>(new Set());
  const isStoppingRef = useRef(false);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [mimeType, setMimeType] = useState<string | null>(null);

  // Wire `ended` listeners on the live tracks so we surface interruption
  // regardless of who started the recorder.
  useEffect(() => {
    if (!stream) return;
    const tracks = stream.getTracks();
    const onEnded = () => setIsInterrupted(true);
    tracks.forEach((t) => t.addEventListener("ended", onEnded));

    return () => {
      tracks.forEach((t) => t.removeEventListener("ended", onEnded));
    };
  }, [stream]);

  const start = useCallback(() => {
    if (!enabled || !stream || !sessionToken) return;
    if (recorderRef.current) return; // already started
    chunkIndexRef.current = 0;
    isStoppingRef.current = false;

    // Construct + start with codec fallback. We must wire ondataavailable
    // BEFORE calling .start(), so tryStartRecorder is split into two
    // phases: pick a viable options bag here, then attach handlers on the
    // returned recorder. The simpler refactor: re-wire handlers after
    // tryStartRecorder returns — the first timeslice fires several seconds
    // later so there's no race.
    const recorder = tryStartRecorder(stream, TIMESLICE_MS, streamType);
    if (!recorder) {
      // Every codec option failed. Soft-fail: interview continues without
      // a recording for this stream. tryStartRecorder already logged the
      // full rejection chain via console.error so the operator can see
      // exactly why each codec was rejected.
      return;
    }

    // Capture the actual chosen codec so the manifest can record it
    // truthfully. MediaRecorder.mimeType reflects what the browser
    // negotiated (e.g. "video/webm;codecs=vp9") regardless of what we
    // requested. Empty string fallback if the browser didn't populate it.
    setMimeType(recorder.mimeType || "video/webm");

    recorder.ondataavailable = (ev: BlobEvent) => {
      if (!ev.data || ev.data.size === 0) return;
      const idx = chunkIndexRef.current;
      chunkIndexRef.current += 1;
      const upload = postChunk(sessionToken, streamType, idx, ev.data).finally(
        () => {
          pendingUploadsRef.current.delete(upload);
        },
      );
      pendingUploadsRef.current.add(upload);
    };
    recorder.onerror = (ev) => {
      console.warn("[proctoring] MediaRecorder runtime error", ev);
    };
    recorderRef.current = recorder;
  }, [enabled, stream, sessionToken, streamType]);

  const stop = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      // .stop() triggers one final ondataavailable for buffered data.
      // We need to wait for that handler to queue its upload before we
      // grab the pending set. The Promise wraps stop's onstop callback.
      await new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
    }
    const pending = Array.from(pendingUploadsRef.current);
    if (pending.length === 0) {
      recorderRef.current = null;

      return;
    }
    // Clearable timeout — cancel when allSettled wins so we don't leak a
    // 30s ghost timer per recorder stop (review finding #2).
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((r) => {
      timeoutId = setTimeout(() => r(), STOP_TIMEOUT_MS);
    });
    await Promise.race([Promise.allSettled(pending), timeout]);
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    recorderRef.current = null;
  }, []);

  // Best-effort cleanup if the hook is torn down mid-recording.
  useEffect(() => {
    return () => {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.stop();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return { start, stop, isInterrupted, mimeType };
}
