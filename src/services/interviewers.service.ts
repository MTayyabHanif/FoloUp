import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Interviewer } from "@/types/interviewer";

const getSupabase = (client?: SupabaseClient) =>
  client ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );

const getAllInterviewers = async (
  _clientId: string = "",
  client?: SupabaseClient,
) => {
  const supabase = getSupabase(client);
  const { data, error } = await supabase
    .from("interviewer")
    .select(`*`)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`getAllInterviewers failed: ${error.message}`);
  }

  return data ?? [];
};

const createInterviewer = async (
  payload: Partial<Interviewer> & { name: string; agent_id: string },
  client?: SupabaseClient,
) => {
  const supabase = getSupabase(client);

  // Idempotency check: a name + agent_id pair must be unique.
  const { data: existingInterviewer, error: checkError } = await supabase
    .from("interviewer")
    .select("*")
    .eq("name", payload.name)
    .filter("agent_id", "eq", payload.agent_id)
    .single();

  // PGRST116 = no rows returned, which is the happy path here.
  if (checkError && checkError.code !== "PGRST116") {
    throw new Error(
      `createInterviewer existence check failed: ${checkError.message}`,
    );
  }

  if (existingInterviewer) {
    // Not an error per se — the bootstrap flow can hit this on retry.
    return existingInterviewer;
  }

  // Chain .select().single() so the created row (including the
  // auto-generated `id` and the supplied `agent_id`) is returned and
  // can be sent back in the POST /api/interviewers 201 response.
  const { data, error } = await supabase
    .from("interviewer")
    .insert({ ...payload })
    .select()
    .single();

  if (error) {
    throw new Error(`createInterviewer failed: ${error.message}`);
  }

  return data;
};

const getInterviewer = async (
  interviewerId: bigint,
  client?: SupabaseClient,
) => {
  const supabase = getSupabase(client);
  const { data, error } = await supabase
    .from("interviewer")
    .select("*")
    .eq("id", interviewerId)
    .single();

  if (error) {
    // PGRST116 = no rows returned. Treat "not found" as `null` so callers
    // (e.g. /api/register-call) can 404 cleanly. All other errors propagate.
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`getInterviewer failed: ${error.message}`);
  }

  return data;
};

// Partial update by id. Callers pass only the fields that changed; the route
// layer has already issued any Retell PATCH calls before reaching here, so a
// non-empty patch object reaching the DB means the Retell side is already
// updated. Returns the updated row.
const updateInterviewer = async (
  id: number,
  patch: Partial<Interviewer>,
  client?: SupabaseClient,
) => {
  const supabase = getSupabase(client);
  const { data, error } = await supabase
    .from("interviewer")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`updateInterviewer failed: ${error.message}`);
  }

  return data;
};

// Soft-delete by id. Idempotent — re-deleting an already-deleted row simply
// overwrites `deleted_at` with a new timestamp and returns the same row.
// Returns the affected row(s); callers check `data.length === 0` for a 404.
// Intentionally does NOT call any Retell delete API — accepted v1 leak.
const deleteInterviewer = async (id: number, client?: SupabaseClient) => {
  const supabase = getSupabase(client);
  const { data, error } = await supabase
    .from("interviewer")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select();

  if (error) {
    throw new Error(`deleteInterviewer failed: ${error.message}`);
  }

  return data ?? [];
};

export const InterviewerService = {
  getAllInterviewers,
  createInterviewer,
  getInterviewer,
  updateInterviewer,
  deleteInterviewer,
};
