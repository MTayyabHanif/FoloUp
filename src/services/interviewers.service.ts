import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

import type { Interviewer } from "@/types/interviewer";

const supabase = createClientComponentClient();

const getAllInterviewers = async (_clientId: string = "") => {
  const { data, error } = await supabase.from("interviewer").select(`*`);

  if (error) {
    throw new Error(`getAllInterviewers failed: ${error.message}`);
  }

  return data ?? [];
};

const createInterviewer = async (
  payload: Partial<Interviewer> & { name: string; agent_id: string },
) => {
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

  const { data, error } = await supabase
    .from("interviewer")
    .insert({ ...payload });

  if (error) {
    throw new Error(`createInterviewer failed: ${error.message}`);
  }

  return data;
};

const getInterviewer = async (interviewerId: bigint) => {
  const { data, error } = await supabase
    .from("interviewer")
    .select("*")
    .eq("id", interviewerId)
    .single();

  if (error) {
    throw new Error(`getInterviewer failed: ${error.message}`);
  }

  return data;
};

export const InterviewerService = {
  getAllInterviewers,
  createInterviewer,
  getInterviewer,
};
