"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ProctoringStreamType = "camera" | "screen";

const TIMESLICE_MS = 10_000;
const MAX_RETRIES = 3;
const STOP_TIMEOUT_MS = 30_000;

function preferredMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "video/webm";
  }
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
    return "video/webm;codecs=vp8";
  }

  return "video/webm";
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

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        mimeType: preferredMimeType(),
        videoBitsPerSecond: 500_000,
      });
    } catch (err) {
      console.warn("[proctoring] MediaRecorder init failed", err);

      return;
    }

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
      console.warn("[proctoring] MediaRecorder error", ev);
    };
    recorder.start(TIMESLICE_MS);
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

  return { start, stop, isInterrupted };
}
