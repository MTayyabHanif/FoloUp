import { createClient } from "@supabase/supabase-js";

import { INVITE_TTL_HOURS } from "@/lib/access-control-constants";
import type { InterviewInvite, InviteStatus } from "@/types/invite";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

const createInvite = async (
  interviewId: string,
  email: string,
): Promise<InterviewInvite> => {
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("interview_invites")
    .insert({
      interview_id: interviewId,
      email: email.toLowerCase().trim(),
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`createInvite failed: ${error?.message ?? "unknown"}`);
  }

  return data as InterviewInvite;
};

const getInviteByToken = async (
  interviewId: string,
  token: string,
): Promise<InterviewInvite | null> => {
  const { data, error } = await supabase
    .from("interview_invites")
    .select("*")
    .eq("interview_id", interviewId)
    .eq("token", token)
    .limit(1);

  if (error) {
    return null;
  }

  return data && data.length > 0 ? (data[0] as InterviewInvite) : null;
};

const markInviteReserved = async (
  inviteId: string,
): Promise<{ ok: true } | { ok: false; reason: "already-reserved" }> => {
  const { data, error } = await supabase
    .from("interview_invites")
    .update({ reserved_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("reserved_at", null)
    .select("id");

  if (error) {
    throw new Error(`markInviteReserved failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return { ok: false, reason: "already-reserved" };
  }

  return { ok: true };
};

const markInviteUsed = async (callId: string): Promise<void> => {
  const { data: responseRow, error: responseError } = await supabase
    .from("response")
    .select("invite_id")
    .eq("call_id", callId)
    .limit(1);

  if (responseError) {
    console.warn(
      `markInviteUsed: response lookup failed for call_id=${callId}: ${responseError.message}`,
    );

    return;
  }

  const inviteId = responseRow?.[0]?.invite_id;
  if (!inviteId) {
    return;
  }

  const { error: updateError } = await supabase
    .from("interview_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", inviteId)
    .is("used_at", null);

  if (updateError) {
    console.warn(
      `markInviteUsed: invite update failed for invite_id=${inviteId}: ${updateError.message}`,
    );
  }
};

const listInvitesForInterview = async (
  interviewId: string,
): Promise<InterviewInvite[]> => {
  const { data, error } = await supabase
    .from("interview_invites")
    .select("*")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`listInvitesForInterview failed: ${error.message}`);
  }

  return (data ?? []) as InterviewInvite[];
};

const revokeInvite = async (inviteId: string): Promise<void> => {
  const { error } = await supabase
    .from("interview_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);

  if (error) {
    throw new Error(`revokeInvite failed: ${error.message}`);
  }
};

const deriveInviteStatus = (invite: InterviewInvite): InviteStatus => {
  if (invite.revoked_at) {
    return "revoked";
  }
  if (invite.used_at) {
    return "used";
  }
  if (invite.reserved_at) {
    return "reserved";
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return "expired";
  }

  return "pending";
};

export const InviteService = {
  createInvite,
  getInviteByToken,
  markInviteReserved,
  markInviteUsed,
  listInvitesForInterview,
  revokeInvite,
  deriveInviteStatus,
};
