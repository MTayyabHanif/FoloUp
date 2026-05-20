import { Resend } from "resend";

import { logger } from "@/lib/logger";
import {
  renderInviteEmail,
  type InviteEmailParams,
} from "@/lib/email-templates";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.INVITE_EMAIL_FROM;

let cachedClient: Resend | null = null;

const getClient = (): Resend | null => {
  if (!apiKey) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = new Resend(apiKey);
  }

  return cachedClient;
};

export type SendInviteEmailOutcome =
  | { ok: true; messageId: string | null }
  | {
      ok: false;
      reason: "not-configured" | "send-failed";
      detail?: string;
    };

const sendInviteEmail = async (
  params: InviteEmailParams,
): Promise<SendInviteEmailOutcome> => {
  const client = getClient();
  if (!client || !fromAddress) {
    logger.warn(
      "Invite email not sent: RESEND_API_KEY or INVITE_EMAIL_FROM is missing.",
      {
        hasApiKey: Boolean(apiKey),
        hasFromAddress: Boolean(fromAddress),
      },
    );

    return { ok: false, reason: "not-configured" };
  }

  const rendered = renderInviteEmail(params);

  try {
    const result = await client.emails.send({
      from: fromAddress,
      to: params.candidateEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(params.recruiterEmail
        ? { reply_to: params.recruiterEmail }
        : {}),
    });

    if (result.error) {
      logger.error("Resend send error", {
        message: result.error.message,
        name: result.error.name,
      });

      return {
        ok: false,
        reason: "send-failed",
        detail: result.error.message,
      };
    }

    return { ok: true, messageId: result.data?.id ?? null };
  } catch (err) {
    logger.error("sendInviteEmail threw", {
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      ok: false,
      reason: "send-failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
};

export const EmailService = {
  sendInviteEmail,
  isConfigured: () => Boolean(apiKey && fromAddress),
};
