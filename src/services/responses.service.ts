import { createClient } from "@supabase/supabase-js";

import type { Response } from "@/types/response";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

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
  const { data, error } = await supabase
    .from("response")
    .select(`*`)
    .eq("interview_id", interviewId)
    .or(`details.is.null, details->call_analysis.not.is.null`)
    .eq("is_ended", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getAllResponses failed: ${error.message}`);
  }

  return data ?? [];
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

export const ResponseService = {
  createResponse,
  saveResponse,
  updateResponse,
  getAllResponses,
  getResponseByCallId,
  deleteResponse,
  getResponseCountByOrganizationId,
  getAllEmails: getAllEmailAddressesForInterview,
};
