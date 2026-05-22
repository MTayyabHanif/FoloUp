"use client";

import { Camera, MonitorPlay, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

type ChunkEntry = { index: number; path: string };

type Manifest = {
  stream: "camera" | "screen";
  chunks: ChunkEntry[];
  mimeType: string;
  createdAt: string;
};

type StreamSlot = {
  kind: "camera" | "screen";
  storagePath: string | null;
  enabled: boolean;
};

export type ProctoringReviewProps = {
  responseId: number;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  cameraStoragePath: string | null;
  screenStoragePath: string | null;
  cameraStatus: string | null;
  screenShareType: string | null;
  proctoringInterrupted: boolean;
  consentAcknowledgedAt: string | null;
  /**
   * Retell call recording URL (audio-only). When present, played in a
   * hidden <audio> element synced to the video player's playhead so the
   * recruiter hears the candidate while watching the camera/screen
   * recording. Standalone audio player below the proctoring section
   * remains independent for audio-only review.
   */
  audioUrl?: string | null;
};

function statusTone(value: string | null, kind: "camera" | "screen") {
  if (!value) return "neutral" as const;
  if (kind === "camera") {
    if (value === "granted") return "green" as const;
    if (value === "unavailable") return "amber" as const;
    if (value === "denied") return "red" as const;
  } else {
    if (value === "monitor") return "green" as const;
    if (value === "unsupported") return "amber" as const;
    if (value === "denied" || value === "window" || value === "browser")
      return "red" as const;
  }

  return "neutral" as const;
}

function Chip({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "amber" | "red" | "neutral";
}) {
  const classes =
    tone === "green"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "amber"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : tone === "red"
          ? "bg-rose-50 border-rose-200 text-rose-800"
          : "bg-stone-50 border-stone-200 text-stone-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}

function formatConsentTimestamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);

    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Build an ordered list of MediaSource-supported mimeType candidates.
 *
 * The manifest's claimed mimeType is tried first (correct manifests are
 * the happy path). But `isTypeSupported` only checks decoder availability,
 * not whether the bytes actually match — so if the FIRST appendBuffer
 * fails (e.g., manifest claims vp8 but bytes are vp9, as in pre-fix
 * manifests), the player falls back to the next candidate. Returns up to
 * 7 ordered candidates; each is checked by `isTypeSupported` before
 * inclusion. Video-only streams (no audio captured).
 */
function supportedMimeCandidates(claimed: string): string[] {
  if (typeof MediaSource === "undefined") return [];
  const raw = [
    claimed,
    'video/webm; codecs="vp9"',
    "video/webm;codecs=vp9",
    'video/webm; codecs="vp8"',
    "video/webm;codecs=vp8",
    "video/webm",
    'video/mp4; codecs="avc1.42E01E"',
  ];
  // De-dupe (claimed may match a later canonical form) and keep only
  // mimes the browser actually decodes.
  const seen = new Set<string>();

  return raw.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);

    return MediaSource.isTypeSupported(m);
  });
}

async function fetchChunkSignedUrl(
  responseId: number,
  stream: "camera" | "screen",
  chunkIndex: number,
): Promise<string> {
  const res = await fetch(
    `/api/proctoring/signed-url?response_id=${responseId}&stream=${stream}&chunk_index=${chunkIndex}`,
  );
  if (!res.ok) throw new Error(`chunk-signed-url ${res.status}`);
  const body = (await res.json()) as { url: string };

  return body.url;
}

// Bounded streaming concurrency. At most this many chunk fetches in
// flight at once. Each chunk is ~250-500KB so memory ceiling is
// ~2MB regardless of interview length. Higher = faster prefetch but
// more memory + simultaneous R2 requests.
const STREAM_CONCURRENCY = 4;
// Above-baseline drift tolerance for video↔audio resync. Browsers
// naturally drift a few ms per minute; correcting under this would
// cause audible jitter.
const AV_SYNC_TOLERANCE_S = 0.25;

/**
 * Unified MSE-based player with streaming chunk load and synced audio.
 *
 * Streaming: kicks off chunk 0 immediately, appends it as soon as it
 * lands (~1s). Continues fetching the rest with bounded concurrency
 * (4 in flight) and appends in order as each arrives. User can play
 * within ~1-2s instead of waiting for a 20-min interview's 400 chunks
 * to all download upfront. Memory stays bounded at ~2MB regardless of
 * interview length.
 *
 * Mime fallback: if chunk 0's appendBuffer rejects (wrong codec in the
 * manifest), tears down the MediaSource and retries with the next
 * candidate mime. Chunk 0's bytes are cached across retries.
 *
 * Audio sync: hidden <audio> tied to the video's play/pause/seeking/
 * ratechange events plus a timeupdate-based drift correction. Plays
 * the Retell call recording in lockstep with the camera/screen video.
 */
function ChunkPlayer({
  responseId,
  stream,
  storagePath,
  audioUrl,
}: {
  responseId: number;
  stream: "camera" | "screen";
  storagePath: string;
  audioUrl?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appendProgress, setAppendProgress] = useState<{
    appended: number;
    total: number;
  } | null>(null);
  const [chunkError, setChunkError] = useState(false);

  // Step 1: fetch the manifest.
  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    setChunkError(false);
    setManifest(null);
    setAppendProgress(null);
    (async () => {
      try {
        const sigRes = await fetch(
          `/api/proctoring/signed-url?response_id=${responseId}&stream=${stream}`,
        );
        if (!sigRes.ok) throw new Error(`signed-url ${sigRes.status}`);
        const sig = (await sigRes.json()) as { url: string };
        const manifestRes = await fetch(sig.url);
        if (!manifestRes.ok) throw new Error(`manifest ${manifestRes.status}`);
        const m = (await manifestRes.json()) as Manifest;
        if (abort) return;
        setManifest(m);
      } catch (err) {
        if (abort) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [responseId, stream, storagePath]);

  // Step 2: once manifest is loaded, stream chunks via MSE with bounded
  // concurrency. Plays as soon as chunk 0 is appended; continues
  // appending in the background. Retries with alternate mime types if
  // chunk 0 rejects (wrong manifest codec).
  useEffect(() => {
    if (!manifest || manifest.chunks.length === 0 || !videoRef.current) {
      return;
    }

    const candidates = supportedMimeCandidates(manifest.mimeType);
    if (candidates.length === 0) {
      setError(
        "Browser does not support any of the recorded codecs (tried VP9, VP8, H.264).",
      );

      return;
    }

    const video = videoRef.current;
    let aborted = false;
    let activeObjectUrl: string | null = null;
    let activeMediaSource: MediaSource | null = null;

    setAppendProgress({ appended: 0, total: manifest.chunks.length });

    // Chunk byte cache, shared across mime-fallback retries so chunk 0
    // isn't re-downloaded if the first mime fails. Memory is bounded
    // because we delete entries after their appendBuffer completes,
    // except for chunk 0 which we deliberately keep cached.
    const chunkCache = new Map<number, Promise<ArrayBuffer | null>>();

    const fetchChunkBytes = async (
      chunkIdx: number,
    ): Promise<ArrayBuffer | null> => {
      try {
        const signedUrl = await fetchChunkSignedUrl(
          responseId,
          stream,
          chunkIdx,
        );
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`chunk ${chunkIdx}: ${res.status}`);

        return await res.arrayBuffer();
      } catch (err) {
        console.warn(
          `[proctoring/${stream}] chunk ${chunkIdx} fetch failed`,
          err,
        );

        return null;
      }
    };

    const ensureChunk = (chunkIdx: number): Promise<ArrayBuffer | null> => {
      let p = chunkCache.get(chunkIdx);
      if (!p) {
        p = fetchChunkBytes(manifest.chunks[chunkIdx].index);
        chunkCache.set(chunkIdx, p);
      }

      return p;
    };

    const tearDown = () => {
      if (activeMediaSource && activeMediaSource.readyState === "open") {
        try {
          activeMediaSource.endOfStream();
        } catch {
          /* noop */
        }
      }
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
      activeMediaSource = null;
      activeObjectUrl = null;
    };

    /**
     * Try one mime candidate with streaming chunk load. Returns:
     *  - { ok: true }                         all (or most) chunks appended
     *  - { ok: false, firstAppendFailed: true } chunk 0 rejected — caller retries with next mime
     *  - { ok: false, firstAppendFailed: false } unrecoverable error — caller stops
     */
    const tryMime = async (
      mime: string,
    ): Promise<{ ok: boolean; firstAppendFailed: boolean }> => {
      const ms = new MediaSource();
      const objectUrl = URL.createObjectURL(ms);
      activeMediaSource = ms;
      activeObjectUrl = objectUrl;
      video.src = objectUrl;
      objectUrlRef.current = objectUrl;

      const sourceOpenPromise = new Promise<void>((resolve) => {
        const onOpen = () => {
          ms.removeEventListener("sourceopen", onOpen);
          resolve();
        };
        ms.addEventListener("sourceopen", onOpen);
      });
      await sourceOpenPromise;
      if (aborted) return { ok: false, firstAppendFailed: false };

      let sb: SourceBuffer;
      try {
        sb = ms.addSourceBuffer(mime);
      } catch (err) {
        console.warn(
          `[proctoring/${stream}] addSourceBuffer(${mime}) threw`,
          err,
        );
        tearDown();

        return { ok: false, firstAppendFailed: true };
      }
      sb.mode = "sequence";

      const appendBuffer = (buf: ArrayBuffer): Promise<void> =>
        new Promise((resolve, reject) => {
          const onEnd = () => {
            sb.removeEventListener("updateend", onEnd);
            sb.removeEventListener("error", onErr);
            resolve();
          };
          const onErr = () => {
            sb.removeEventListener("updateend", onEnd);
            sb.removeEventListener("error", onErr);
            reject(new Error("SourceBuffer error"));
          };
          sb.addEventListener("updateend", onEnd);
          sb.addEventListener("error", onErr);
          sb.appendBuffer(buf);
        });

      const total = manifest.chunks.length;
      let appendedCount = 0;
      let anyFailed = false;

      // Append chunk 0 first as a sentinel — if it rejects, the mime is
      // wrong and we bail to let the caller try the next candidate.
      const chunk0 = await ensureChunk(0);
      if (aborted) return { ok: false, firstAppendFailed: false };
      if (!chunk0) {
        setError("Could not download the first segment of the recording.");
        tearDown();

        return { ok: false, firstAppendFailed: false };
      }
      try {
        await appendBuffer(chunk0);
      } catch (err) {
        console.warn(
          `[proctoring/${stream}] appendBuffer rejected at chunk 0 with mime=${mime} — will try next mime`,
          err,
        );
        tearDown();

        return { ok: false, firstAppendFailed: true };
      }
      appendedCount = 1;
      setAppendProgress({ appended: 1, total });

      // Bounded-concurrency streaming for chunks 1..N-1. Pre-fetch up to
      // STREAM_CONCURRENCY chunks ahead of the append cursor so the
      // network is utilized but memory stays bounded.
      for (let i = 1; i < total; i += 1) {
        if (aborted) return { ok: false, firstAppendFailed: false };
        // Kick off prefetches in the sliding window.
        for (
          let j = i;
          j < i + STREAM_CONCURRENCY && j < total;
          j += 1
        ) {
          ensureChunk(j);
        }
        const buf = await ensureChunk(i);
        // Release the cache slot for chunk i once we've awaited it. Keep
        // chunk 0 cached in case a future re-mount triggers a re-mime.
        if (i > 0) chunkCache.delete(i);
        if (!buf) {
          anyFailed = true;
          appendedCount += 1;
          setAppendProgress({ appended: appendedCount, total });
          continue;
        }
        try {
          await appendBuffer(buf);
        } catch (err) {
          console.warn(
            `[proctoring/${stream}] appendBuffer failed at chunk ${i} with mime=${mime}`,
            err,
          );
          anyFailed = true;
        }
        appendedCount += 1;
        setAppendProgress({ appended: appendedCount, total });
      }

      if (!aborted && ms.readyState === "open") {
        try {
          ms.endOfStream();
        } catch {
          /* noop */
        }
      }
      if (anyFailed) setChunkError(true);

      return { ok: true, firstAppendFailed: false };
    };

    (async () => {
      for (const mime of candidates) {
        if (aborted) return;
        console.info(
          `[proctoring/${stream}] attempting MSE playback with mime=${mime}`,
        );
        const result = await tryMime(mime);
        if (result.ok) {
          console.info(
            `[proctoring/${stream}] MSE playback succeeded with mime=${mime}`,
          );

          return;
        }
        if (!result.firstAppendFailed) return; // unrecoverable
        // else: chunk 0 rejected, try next mime — chunk 0 is still in cache
      }
      setError(
        `Browser couldn't decode the recorded chunks. Tried ${candidates.length} codec variant(s). Check console for details.`,
      );
    })();

    return () => {
      aborted = true;
      tearDown();
    };
  }, [manifest, responseId, stream]);

  // Step 3: keep the hidden audio element in lockstep with the video's
  // playhead. Native browser drift between two media elements is ~1-3ms
  // per minute; we tolerate up to AV_SYNC_TOLERANCE_S before resyncing
  // to avoid audible jitter from frequent corrections.
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio || !audioUrl) return;

    const onPlay = () => {
      audio.currentTime = video.currentTime;
      void audio.play().catch(() => {
        /* autoplay blocked or audio still loading — recoverable on next play */
      });
    };
    const onPause = () => {
      audio.pause();
    };
    const onSeeking = () => {
      audio.currentTime = video.currentTime;
    };
    const onRateChange = () => {
      audio.playbackRate = video.playbackRate;
    };
    const onTimeUpdate = () => {
      if (video.seeking || video.paused) return;
      const drift = Math.abs(audio.currentTime - video.currentTime);
      if (drift > AV_SYNC_TOLERANCE_S) {
        audio.currentTime = video.currentTime;
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("ratechange", onRateChange);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("ratechange", onRateChange);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [audioUrl]);

  if (loading) {
    return (
      <Skeleton
        className={stream === "screen" ? "h-64 w-full" : "h-72 w-full"}
      />
    );
  }
  if (error) {
    return (
      <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        Failed to load recording: {error}
      </div>
    );
  }
  if (!manifest || manifest.chunks.length === 0) {
    return (
      <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Recording manifest is empty. The session may have ended before any
        chunks were uploaded.
      </div>
    );
  }

  const isBuffering =
    appendProgress !== null && appendProgress.appended < appendProgress.total;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[16px] border border-[#e0e5d5] bg-black">
        <video
          ref={videoRef}
          controls
          className={
            stream === "screen"
              ? "h-auto w-full max-h-[460px]"
              : "h-auto w-full max-h-[320px] object-contain"
          }
        />
        {audioUrl ? (
          // Hidden audio element synced to the video above via the
          // useEffect that wires play/pause/seek/timeupdate. The
          // standalone Retell audio player elsewhere on the page is
          // independent — both can be controlled separately.
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="auto"
            className="hidden"
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between text-xs text-[#53614d]">
        <span>
          {isBuffering
            ? `Streaming ${appendProgress!.appended} / ${appendProgress!.total} segments…`
            : `${manifest.chunks.length} segments • ${Math.round(manifest.chunks.length * 3)}s recorded${audioUrl ? " • audio synced" : ""}`}
        </span>
      </div>
      {chunkError ? (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Some segments couldn&apos;t be loaded. Playback may have gaps.
        </div>
      ) : null}
    </div>
  );
}

export function ProctoringReview({
  responseId,
  cameraEnabled,
  screenEnabled,
  cameraStoragePath,
  screenStoragePath,
  cameraStatus,
  screenShareType,
  proctoringInterrupted,
  consentAcknowledgedAt,
  audioUrl,
}: ProctoringReviewProps) {
  const slots = useMemo<StreamSlot[]>(
    () => [
      {
        kind: "screen",
        storagePath: screenStoragePath,
        enabled: screenEnabled,
      },
      {
        kind: "camera",
        storagePath: cameraStoragePath,
        enabled: cameraEnabled,
      },
    ],
    [cameraEnabled, cameraStoragePath, screenEnabled, screenStoragePath],
  );

  if (!cameraEnabled && !screenEnabled) return null;

  return (
    <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7e8b5]/45 text-[#203b14]">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <p
            className="text-[11px] uppercase tracking-[0.18em] text-[#6f7866]"
            style={{ fontFamily: "var(--font-fragmentmono)" }}
          >
            Proctoring
          </p>
          <h2 className="text-xl font-semibold leading-tight tracking-[-0.04em]">
            Session recording
          </h2>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {cameraEnabled ? (
          <Chip
            label={`Camera: ${cameraStatus ?? "not recorded"}`}
            tone={statusTone(cameraStatus, "camera")}
          />
        ) : null}
        {screenEnabled ? (
          <Chip
            label={`Screen: ${screenShareType ?? "not recorded"}`}
            tone={statusTone(screenShareType, "screen")}
          />
        ) : null}
        <Chip
          label={
            proctoringInterrupted ? "Interrupted mid-call" : "Uninterrupted"
          }
          tone={proctoringInterrupted ? "red" : "green"}
        />
        <span className="text-xs text-[#53614d]">
          Consent given at {formatConsentTimestamp(consentAcknowledgedAt)}
        </span>
      </div>

      <div className="mt-6 space-y-6">
        {slots.map((slot) => {
          if (!slot.enabled) return null;
          const icon =
            slot.kind === "camera" ? (
              <Camera className="h-4 w-4" />
            ) : (
              <MonitorPlay className="h-4 w-4" />
            );
          const title =
            slot.kind === "camera" ? "Camera recording" : "Screen recording";

          return (
            <div key={slot.kind} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#0a1d08]">
                {icon}
                {title}
              </div>
              {slot.storagePath ? (
                <ChunkPlayer
                  responseId={responseId}
                  stream={slot.kind}
                  storagePath={slot.storagePath}
                  audioUrl={audioUrl}
                />
              ) : (
                <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">
                    No {slot.kind} recording was saved.
                  </p>
                  <p className="mt-1 text-amber-800/85">
                    The candidate&apos;s browser either couldn&apos;t encode
                    the {slot.kind} stream (incompatible codecs), the call
                    ended before any chunks uploaded, or the tab was closed
                    mid-upload. Check the candidate&apos;s console at
                    interview time for{" "}
                    <code className="rounded bg-amber-100 px-1 font-mono text-xs">
                      [proctoring/{slot.kind}]
                    </code>{" "}
                    warnings.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
