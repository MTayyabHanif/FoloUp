"use client";

import { Camera, MonitorPlay, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
 * Sequential WebM chunk player.
 *
 * Reads the manifest signed URL, then iterates through chunk signed URLs
 * playing each in turn. On chunk-load failure, surfaces a non-blocking
 * warning and skips to the next chunk. MSE-based unified playback is
 * deferred to v1.1 — see openspec design.md.
 */
function ChunkPlayer({
  responseId,
  stream,
  storagePath,
}: {
  responseId: number;
  stream: "camera" | "screen";
  storagePath: string;
}) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chunkError, setChunkError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch manifest signed URL → fetch manifest JSON
  useEffect(() => {
    let abort = false;
    setLoading(true);
    setError(null);
    setChunkError(false);
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
        setCurrentIndex(0);
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

  // Resolve signed URL for the current chunk
  useEffect(() => {
    if (!manifest || currentIndex >= manifest.chunks.length) {
      setCurrentUrl(null);

      return;
    }
    let abort = false;
    const chunk = manifest.chunks[currentIndex];
    (async () => {
      try {
        const res = await fetch(
          `/api/proctoring/signed-url?response_id=${responseId}&stream=${stream}&chunk_index=${chunk.index}`,
        );
        if (!res.ok) throw new Error(`chunk-signed-url ${res.status}`);
        const body = (await res.json()) as { url: string };
        if (abort) return;
        setCurrentUrl(body.url);
      } catch {
        if (abort) return;
        setChunkError(true);
        setCurrentIndex((i) => i + 1);
      }
    })();

    return () => {
      abort = true;
    };
  }, [manifest, currentIndex, responseId, stream]);

  const onVideoEnded = useCallback(() => {
    setCurrentIndex((i) => i + 1);
  }, []);

  const onVideoError = useCallback(() => {
    setChunkError(true);
    setCurrentIndex((i) => i + 1);
  }, []);

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

  const isComplete = currentIndex >= manifest.chunks.length;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[16px] border border-[#e0e5d5] bg-black">
        {currentUrl && !isComplete ? (
          <video
            ref={videoRef}
            key={`${stream}-${currentIndex}`}
            src={currentUrl}
            controls
            autoPlay
            className={
              stream === "screen"
                ? "h-auto w-full max-h-[460px]"
                : "h-auto w-full max-h-[320px] object-contain"
            }
            onEnded={onVideoEnded}
            onError={onVideoError}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-stone-200">
            Playback complete
          </div>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-[#53614d]">
        <span>
          Segment {Math.min(currentIndex + 1, manifest.chunks.length)} of{" "}
          {manifest.chunks.length}
        </span>
        <button
          type="button"
          className="rounded-full border border-[#e0e5d5] px-3 py-1 hover:border-[#203b14] hover:text-[#0a1d08]"
          onClick={() => setCurrentIndex(0)}
        >
          Replay from start
        </button>
      </div>
      {chunkError ? (
        <div className="rounded-[12px] border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Some segments couldn&apos;t be loaded. Playback may be incomplete.
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
                />
              ) : (
                <div className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Recording not available. The session ended before the
                  recording could be saved.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
