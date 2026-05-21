import { createClient } from "@supabase/supabase-js";

import { PUBLIC_TOKEN_TTL_HOURS } from "@/lib/access-control-constants";
import type { Interview } from "@/types/interview";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

class InviteOnlyAnonymousConflictError extends Error {
  status = 422 as const;
  code = "invite_only_anonymous_conflict" as const;
  constructor() {
    super(
      "invite_only=true is incompatible with is_anonymous=true; disable Anonymous first",
    );
  }
}

export const isInviteOnlyAnonymousConflict = (
  err: unknown,
): err is InviteOnlyAnonymousConflictError =>
  err instanceof InviteOnlyAnonymousConflictError;

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
  // Cascade child rows in app code: the FKs on `response.interview_id` and
  // `feedback.interview_id` were created without ON DELETE CASCADE, so a bare
  // DELETE on interview returns 409 / 23503 whenever any response exists.
  const { error: responseError } = await supabase
    .from("response")
    .delete()
    .eq("interview_id", id);

  if (responseError) {
    throw new Error(
      `deleteInterview failed (responses): ${responseError.message}`,
    );
  }

  const { error: feedbackError } = await supabase
    .from("feedback")
    .delete()
    .eq("interview_id", id);

  if (feedbackError) {
    throw new Error(
      `deleteInterview failed (feedback): ${feedbackError.message}`,
    );
  }

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

const rotatePublicToken = async (
  interviewId: string,
): Promise<{ public_token: string; public_token_expires_at: string }> => {
  // crypto.randomUUID is available in Node 16+ and the Edge runtime.
  const newToken = crypto.randomUUID();
  const newExpiresAt = new Date(
    Date.now() + PUBLIC_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("interview")
    .update({
      public_token: newToken,
      public_token_expires_at: newExpiresAt,
    })
    .eq("id", interviewId)
    .select("public_token, public_token_expires_at")
    .single();

  if (error || !data) {
    throw new Error(`rotatePublicToken failed: ${error?.message ?? "unknown"}`);
  }

  return {
    public_token: data.public_token as string,
    public_token_expires_at: data.public_token_expires_at as string,
  };
};

const updateInviteOnlyFlag = async (
  interviewId: string,
  inviteOnly: boolean,
): Promise<void> => {
  if (inviteOnly) {
    const { data: existing, error: fetchError } = await supabase
      .from("interview")
      .select("is_anonymous")
      .eq("id", interviewId)
      .single();

    if (fetchError || !existing) {
      throw new Error(
        `updateInviteOnlyFlag fetch failed: ${fetchError?.message ?? "not found"}`,
      );
    }

    if (existing.is_anonymous) {
      throw new InviteOnlyAnonymousConflictError();
    }
  }

  const { error } = await supabase
    .from("interview")
    .update({ invite_only: inviteOnly })
    .eq("id", interviewId);

  if (error) {
    throw new Error(`updateInviteOnlyFlag failed: ${error.message}`);
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
  rotatePublicToken,
  updateInviteOnlyFlag,
};
