/**
 * Recruiter-facing labels for Retell's `disconnection_reason` enum.
 *
 * Source: retell-sdk/resources/call.d.ts (WebCallResponse.disconnection_reason).
 * Specific labels are preserved for `error_*` values — recruiters diagnosing
 * patterns need to distinguish ASR failures from LLM failures from Twilio
 * failures, so do not collapse them all to a generic "Network Error".
 */
export const DISCONNECTION_REASON_LABELS: Record<string, string> = {
  user_hangup: "Candidate ended the call",
  agent_hangup: "Interview completed normally",
  call_transfer: "Call transferred",
  voicemail_reached: "Voicemail reached",
  inactivity: "Session ended due to inactivity",
  machine_detected: "Answering machine detected",
  max_duration_reached: "Interview time limit reached",
  concurrency_limit_reached: "Service at capacity — please retry",
  no_valid_payment: "Account payment issue",
  scam_detected: "Call flagged by fraud detection",
  error_inbound_webhook: "Webhook configuration error",
  dial_busy: "Line busy",
  dial_failed: "Call failed to connect",
  dial_no_answer: "No answer",
  error_llm_websocket_open: "AI service connection failed (open)",
  error_llm_websocket_lost_connection: "AI service lost connection",
  error_llm_websocket_runtime: "AI service runtime error",
  error_llm_websocket_corrupt_payload: "AI service data error",
  error_frontend_corrupted_payload: "Browser data error",
  error_twilio: "Telephony provider error (Twilio)",
  error_no_audio_received: "No audio detected from candidate",
  error_asr: "Speech recognition error",
  error_retell: "Retell service error",
  error_unknown: "Unknown error",
  error_user_not_joined: "Candidate never joined the call",
  registered_call_timeout: "Interview link expired before candidate joined",
};

export function humanizeDisconnectionReason(
  reason: string | null | undefined,
): string | null {
  if (!reason) {return null;}
  
return DISCONNECTION_REASON_LABELS[reason] ?? reason;
}
