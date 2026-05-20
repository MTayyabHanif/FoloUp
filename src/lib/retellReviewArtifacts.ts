import type { CallData, Response } from "@/types/response";

type RetellReviewLike = Partial<
  Pick<CallData, "transcript" | "transcript_object" | "recording_url" | "call_analysis">
>;

export function hasRetellReviewArtifacts(
  call: RetellReviewLike | null | undefined,
): boolean {
  const hasTranscript =
    typeof call?.transcript === "string" && call.transcript.trim().length > 0;
  const hasTranscriptObject =
    Array.isArray(call?.transcript_object) && call.transcript_object.length > 0;
  const hasRecordingUrl =
    typeof call?.recording_url === "string" && call.recording_url.length > 0;
  const hasCallAnalysis =
    typeof call?.call_analysis === "object" && call.call_analysis !== null;

  return (
    hasTranscript && hasTranscriptObject && hasRecordingUrl && hasCallAnalysis
  );
}

export function needsRetellReviewRefresh(
  response:
    | Pick<Response, "is_analysed" | "questions_covered"> & {
        details?: RetellReviewLike | null;
      }
    | null
    | undefined,
): boolean {
  if (!response) {
    return true;
  }

  if (!response.is_analysed) {
    return true;
  }

  if (!hasRetellReviewArtifacts(response.details)) {
    return true;
  }

  return response.questions_covered === null;
}

export function countQuestionsCovered(
  transcriptObject:
    | Array<{
        role: string;
        content?: string;
      }>
    | null
    | undefined,
  questionCount: number | null | undefined,
): number | null {
  if (!Array.isArray(transcriptObject)) {
    return null;
  }

  const userTurns = transcriptObject.filter(
    (turn) =>
      turn?.role === "user" &&
      typeof turn.content === "string" &&
      turn.content.trim().length > 20,
  ).length;

  const cap = typeof questionCount === "number" ? questionCount : userTurns;

  return Math.min(userTurns, cap);
}
