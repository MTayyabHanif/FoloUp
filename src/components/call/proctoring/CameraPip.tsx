"use client";

import { useEffect, useRef } from "react";

export type CameraStatus = "granted" | "denied" | "unavailable" | null;

export type CameraPipProps = {
  stream: MediaStream | null;
  cameraStatus: CameraStatus;
};

/**
 * Self-view PIP for the candidate during an active proctored call.
 *
 * - When cameraStatus === "granted" and stream is present: small mirrored
 *   <video> with a "REC" indicator
 * - When cameraStatus === "denied" or "unavailable": chip placeholder at
 *   the same position so the candidate has feedback that camera was
 *   attempted but is not active (instead of silent absence)
 */
export function CameraPip({ stream, cameraStatus }: CameraPipProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  if (cameraStatus === "denied" || cameraStatus === "unavailable") {
    return (
      <div className="fixed bottom-4 right-4 z-40 rounded-full border border-[#e0e5d5] bg-stone-100/95 px-3 py-2 text-xs font-medium text-stone-600 shadow-sm">
        Camera unavailable — continuing without video
      </div>
    );
  }

  if (cameraStatus !== "granted" || !stream) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 overflow-hidden rounded-[12px] border border-[#c5ccb6] bg-black shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="h-24 w-32 object-cover"
        style={{ transform: "scaleX(-1)" }}
      />
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        REC
      </div>
    </div>
  );
}
