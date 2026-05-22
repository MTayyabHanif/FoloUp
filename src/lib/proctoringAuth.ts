import { getSupabaseServiceClient } from "@/lib/supabaseServer";

export type SessionTokenContext = {
  responseId: number;
  interviewId: string;
  organizationId: string;
};

/**
 * Resolve a session_token bearer to the response + interview + org_id chain.
 * Returns null if the token is unknown or any join fails — callers should
 * 401 on null.
 *
 * The candidate-side proctoring routes use this for auth: the unguessable
 * session_token (UUID, 128 bits of entropy, issued by /api/register-call) is
 * treated as a bearer credential. Server-side we look up the response row
 * and derive the org_id via the interview join. The client never sends
 * org_id; we never trust it from the wire.
 */
export async function resolveSessionToken(
  sessionToken: string | null | undefined,
): Promise<SessionTokenContext | null> {
  if (!sessionToken) return null;

  const supabase = getSupabaseServiceClient();

  const { data, error } = await supabase
    .from("response")
    .select("id, interview_id, interview:interview_id(organization_id)")
    .eq("session_token", sessionToken)
    .maybeSingle();

  if (error || !data || !data.interview_id) return null;

  // Supabase nested select returns interview as object (single row joined).
  const interview = (
    Array.isArray(data.interview) ? data.interview[0] : data.interview
  ) as { organization_id: string | null } | null;
  if (!interview?.organization_id) return null;

  return {
    responseId: data.id,
    interviewId: data.interview_id,
    organizationId: interview.organization_id,
  };
}

export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());

  return match ? match[1] : null;
}
