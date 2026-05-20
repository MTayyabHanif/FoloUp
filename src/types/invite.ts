export interface InterviewInvite {
  id: string;
  interview_id: string;
  token: string;
  email: string;
  created_at: string;
  expires_at: string;
  reserved_at: string | null;
  used_at: string | null;
  revoked_at: string | null;
}

export type InviteStatus =
  | "pending"
  | "reserved"
  | "used"
  | "revoked"
  | "expired";

export type AccessState =
  | "valid"
  | "expired-public"
  | "invite-required"
  | "invite-invalid"
  | "invite-expired"
  | "invite-already-used";

export type AccessMode = "public" | "invite" | "owner_bypass";

export interface ValidateAccessResponse {
  state: AccessState;
  access_mode?: AccessMode;
  invite_id?: string;
}
