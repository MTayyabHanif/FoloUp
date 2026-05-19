import { createClient } from "@supabase/supabase-js";

import type { Interview } from "@/types/interview";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Change #3 wave 2: services re-throw on DB errors instead of
 * `console.log(error); return []`. The silent-empty pattern masked failures
 * as "no data" and made UX failures invisible. Callers must wrap calls in
 * try/catch + toastError; service layer stays isomorphic (server-safe).
 */

const getAllInterviews = async (userId: string, organizationId: string) => {
  const { data, error } = await supabase
    .from("interview")
    .select(`*`)
    .or(`organization_id.eq.${organizationId},user_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getAllInterviews failed: ${error.message}`);
  }

  return data ?? [];
};

const getInterviewById = async (id: string) => {
  const { data, error } = await supabase
    .from("interview")
    .select(`*`)
    .or(`id.eq.${id},readable_slug.eq.${id}`);

  if (error) {
    throw new Error(`getInterviewById failed: ${error.message}`);
  }

  return data && data.length > 0 ? data[0] : null;
};

const updateInterview = async (
  payload: Record<string, unknown>,
  id: string,
) => {
  const { data, error } = await supabase
    .from("interview")
    .update({ ...payload })
    .eq("id", id);

  if (error) {
    throw new Error(`updateInterview failed: ${error.message}`);
  }

  return data;
};

const deleteInterview = async (id: string) => {
  const { data, error } = await supabase
    .from("interview")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`deleteInterview failed: ${error.message}`);
  }

  return data;
};

const getAllRespondents = async (interviewId: string) => {
  const { data, error } = await supabase
    .from("interview")
    .select(`respondents`)
    .eq("interview_id", interviewId);

  if (error) {
    throw new Error(`getAllRespondents failed: ${error.message}`);
  }

  return data ?? [];
};

const createInterview = async (payload: Record<string, unknown>) => {
  const { data, error } = await supabase
    .from("interview")
    .insert({ ...payload });

  if (error) {
    throw new Error(`createInterview failed: ${error.message}`);
  }

  return data;
};

const deactivateInterviewsByOrgId = async (organizationId: string) => {
  const { error } = await supabase
    .from("interview")
    .update({ is_active: false })
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  if (error) {
    throw new Error(`deactivateInterviewsByOrgId failed: ${error.message}`);
  }
};

export const InterviewService = {
  getAllInterviews,
  getInterviewById,
  updateInterview,
  deleteInterview,
  getAllRespondents,
  createInterview,
  deactivateInterviewsByOrgId,
};
