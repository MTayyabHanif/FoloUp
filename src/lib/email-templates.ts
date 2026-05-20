import { INVITE_TTL_HOURS } from "@/lib/access-control-constants";

export interface InviteEmailParams {
  candidateEmail: string;
  interviewName: string;
  inviteUrl: string;
  organizationName?: string | null;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderInviteEmail(params: InviteEmailParams): RenderedEmail {
  const {
    candidateEmail,
    interviewName,
    inviteUrl,
    organizationName,
    recruiterName,
  } = params;

  const orgLine = organizationName
    ? `${escapeHtml(organizationName)} has invited you`
    : "You've been invited";

  const senderLine = recruiterName
    ? `${escapeHtml(recruiterName)}${organizationName ? ` at ${escapeHtml(organizationName)}` : ""}`
    : organizationName
      ? `The team at ${escapeHtml(organizationName)}`
      : "The hiring team";

  const subject = organizationName
    ? `Your interview invitation from ${organizationName}`
    : `You've been invited to an interview`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0a1d08;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8ef;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#fbfdf6;border:1px solid #c5ccb6;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 16px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#203b14;">Interview invitation</p>
                <h1 style="margin:0;font-size:24px;line-height:1.2;font-weight:600;letter-spacing:-0.02em;color:#0a1d08;">${orgLine} to interview for ${escapeHtml(interviewName)}.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 24px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.55;color:#31200b;">
                  Hi ${escapeHtml(candidateEmail)},
                </p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#31200b;">
                  ${senderLine} would like you to complete a short AI-led interview for the role above. The interview runs in your browser — no install required.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="border-radius:999px;background:#4a3212;">
                      <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#fbfdf6;text-decoration:none;">Start your interview →</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 8px;font-size:13px;line-height:1.55;color:#53614d;">
                  Or copy this link into your browser:
                </p>
                <p style="margin:0 0 24px;font-size:13px;line-height:1.55;word-break:break-all;color:#0a1d08;background:#f6f8ef;border:1px solid #e0e5d5;border-radius:12px;padding:12px 14px;">
                  ${escapeHtml(inviteUrl)}
                </p>
                <div style="border-top:1px solid #e0e5d5;padding-top:20px;">
                  <p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#53614d;">
                    <strong style="color:#0a1d08;">This invitation is personal to you.</strong> It only works with the email <code style="background:#f6f8ef;padding:1px 6px;border-radius:6px;font-size:12px;">${escapeHtml(candidateEmail)}</code>, and it expires in ${INVITE_TTL_HOURS} hours.
                  </p>
                  <p style="margin:0;font-size:13px;line-height:1.55;color:#53614d;">
                    Questions? Reply to this email and it will reach the recruiter directly.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 28px;background:#f6f8ef;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6f7866;">
                Sent by Robust Devs Hiring
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `${orgLine.replace(/&[a-z]+;/gi, "")} to interview for ${interviewName}.`,
    "",
    `Hi ${candidateEmail},`,
    "",
    `${recruiterName ?? "The hiring team"}${organizationName ? ` at ${organizationName}` : ""} would like you to complete a short AI-led interview. The interview runs in your browser — no install required.`,
    "",
    `Start your interview: ${inviteUrl}`,
    "",
    `This invitation is personal to you. It only works with the email ${candidateEmail}, and it expires in ${INVITE_TTL_HOURS} hours.`,
    "",
    "Questions? Reply to this email and it will reach the recruiter directly.",
    "",
    "—",
    "Sent by Robust Devs Hiring",
  ].join("\n");

  return { subject, html, text };
}
