import { createClient } from "@supabase/supabase-js";

import type { Response, ResponseStatus } from "@/types/response";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

const LEGACY_VISIBLE_RESPONSES_FILTER =
  "details.is.null, details->call_analysis.not.is.null";

const isMissingResponseStatusColumn = (
  error: { code?: string; message?: string } | null,
): boolean =>
  error?.code === "42703" &&
  error.message?.includes("column response.status does not exist") === true;

const normalizeLegacyResponses = (rows: Partial<Response>[]): Response[] =>
  rows.map((row) => ({
    ...row,
    status: row.is_ended ? "completed" : "interrupted",
  })) as Response[];

/**
 * Change #3 wave 2: services re-throw on errors.
 *
 * EXCEPTION (per design AD-5): `createResponse` returns `null` on failure
 * instead of throwing — the candidate flow must not crash mid-interview if
 * a single response insert fails. Caller shows visible error + retry.
 */

const createResponse = async (
  payload: Partial<Response>,
): Promise<string | null> => {
  const { data, error } = await supabase
    .from("response")
    .insert({ ...payload })
    .select("id");

  if (error) {
    // Candidate flow exception — do NOT throw; return null so the caller
    // can show a non-blocking retry UI.
    return null;
  }

  return data?.[0]?.id ?? null;
};

const saveResponse = async (payload: Partial<Response>, call_id: string) => {
  const { data, error } = await supabase
    .from("response")
    .update({ ...payload })
    .eq("call_id", call_id);

  if (error) {
    throw new Error(`saveResponse failed: ${error.message}`);
  }

  return data;
};

const getAllResponses = async (interviewId: string) => {
  // Filter on `status` rather than `is_ended`. Both ongoing and ended rows are
  // returned; the dashboard's "Show live sessions" toggle decides whether
  // ongoing rows are rendered. The previous `details.is.null, details->call_analysis.not.is.null`
  // OR-clause was a workaround for is_ended-only rows missing analysis — no longer needed.
  const { data, error } = await supabase
    .from("response")
    .select(`*`)
    .eq("interview_id", interviewId)
    .in("status", ["completed", "interrupted", "abandoned", "ongoing"])
    .order("created_at", { ascending: false });

  if (!error) {
    return data ?? [];
  }

  if (isMissingResponseStatusColumn(error)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("response")
      .select(`*`)
      .eq("interview_id", interviewId)
      .or(LEGACY_VISIBLE_RESPONSES_FILTER)
      .eq("is_ended", true)
      .order("created_at", { ascending: false });

    if (legacyError) {
      throw new Error(`getAllResponses failed: ${legacyError.message}`);
    }

    return normalizeLegacyResponses(legacyData ?? []);
  }

  if (error) {
    throw new Error(`getAllResponses failed: ${error.message}`);
  }

  return [];
};

const getResponseCountByOrganizationId = async (
  organizationId: string,
): Promise<number> => {
  const { count, error } = await supabase
    .from("interview")
    .select("response(id)", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(
      `getResponseCountByOrganizationId failed: ${error.message}`,
    );
  }

  return count ?? 0;
};

const getAllEmailAddressesForInterview = async (interviewId: string) => {
  const { data, error } = await supabase
    .from("response")
    .select(`email`)
    .eq("interview_id", interviewId);

  if (error) {
    throw new Error(`getAllEmails failed: ${error.message}`);
  }

  return data ?? [];
};

const getResponseByCallId = async (id: string) => {
  const { data, error } = await supabase
    .from("response")
    .select(`*`)
    .filter("call_id", "eq", id);

  if (error) {
    throw new Error(`getResponseByCallId failed: ${error.message}`);
  }

  return data && data.length > 0 ? data[0] : null;
};

const deleteResponse = async (id: string) => {
  const { data, error } = await supabase
    .from("response")
    .delete()
    .eq("call_id", id);

  if (error) {
    throw new Error(`deleteResponse failed: ${error.message}`);
  }

  return data;
};

const updateResponse = async (payload: Partial<Response>, call_id: string) => {
  const { data, error } = await supabase
    .from("response")
    .update({ ...payload })
    .eq("call_id", call_id);

  if (error) {
    throw new Error(`updateResponse failed: ${error.message}`);
  }

  return data;
};

/**
 * Atomic conditional UPDATE — applies `payload` to the row matching `call_id`
 * only when the guard column equals the guard value. Used by the `call_ended`
 * webhook to write end-state exactly once: `.eq('status', 'ongoing')` IS the
 * idempotency guard. Returns `{ updated: true }` if a row was actually updated,
 * `{ updated: false }` for no-op (the row was already closed by an earlier
 * webhook delivery, or the row doesn't exist yet).
 */
const saveResponseConditional = async (
  payload: Partial<Response>,
  call_id: string,
  guard: { column: keyof Response; value: unknown },
): Promise<{ updated: boolean }> => {
  const { data, error } = await supabase
    .from("response")
    .update({ ...payload })
    .eq("call_id", call_id)
    .eq(guard.column as string, guard.value as never)
    .select("id");

  if (error) {
    throw new Error(`saveResponseConditional failed: ${error.message}`);
  }

  return { updated: (data?.length ?? 0) > 0 };
};

const getResponseBySessionToken = async (token: string) => {
  const { data, error } = await supabase
    .from("response")
    .select(`*`)
    .eq("session_token", token)
    .limit(1);

  if (error) {
    throw new Error(`getResponseBySessionToken failed: ${error.message}`);
  }

  return data && data.length > 0 ? data[0] : null;
};

const updateResponseStatus = async (
  call_id: string,
  payload: {
    status: ResponseStatus;
    disconnection_reason?: string | null;
    is_ended?: boolean;
    last_active_at?: string;
  },
) => {
  const { data, error } = await supabase
    .from("response")
    .update(payload)
    .eq("call_id", call_id);

  if (error) {
    throw new Error(`updateResponseStatus failed: ${error.message}`);
  }

  return data;
};

export const ResponseService = {
  createResponse,
  saveResponse,
  saveResponseConditional,
  updateResponse,
  updateResponseStatus,
  getAllResponses,
  getResponseByCallId,
  getResponseBySessionToken,
  deleteResponse,
  getResponseCountByOrganizationId,
  getAllEmails: getAllEmailAddressesForInterview,
};
