"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  Clock3,
  Lock,
  MailQuestion,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";

function SurfaceShell({
  icon,
  eyebrow,
  title,
  description,
  detail,
  helpEyebrow,
  helpBody,
  action,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  helpEyebrow: string;
  helpBody: string;
  action?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[32px] border border-[#c5ccb6] bg-[#fbfdf6]/95 shadow-[rgba(99,143,61,0.1)_0px_0px_0px_1px]">
      <div className="grid gap-10 px-6 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#203b14]">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-[#0a1d08] md:text-[3.3rem] md:leading-[1.05]">
              {title}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-[#31200b]/78 md:text-lg">
              {description}
            </p>
          </div>
          <div className="rounded-[24px] border border-[#e0e5d5] bg-[#f6f8ef] p-5 text-sm leading-6 text-[#31200b]/82">
            {detail}
          </div>
          {action ? <div className="pt-1">{action}</div> : null}
        </div>

        <div className="flex items-center justify-center">
          <div className="flex min-h-[280px] w-full max-w-sm flex-col items-center justify-center rounded-[28px] border border-[#e0e5d5] bg-white/70 p-8 text-center">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#d7e8b5]/45 text-[#203b14]">
              {icon}
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#203b14]">
              {helpEyebrow}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#31200b]/72">
              {helpBody}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExpiredLinkSurface() {
  return (
    <SurfaceShell
      icon={<Clock3 className="h-9 w-9" />}
      eyebrow="Link expired"
      title="This interview link has expired"
      description="Share links expire after 24 hours to keep candidate access fresh. Your link is no longer active, but a new one can be sent to you."
      detail="If a recruiter shared this link with you over email or chat, reply and ask for a refreshed link. The interview itself is still there — just the link needs to be regenerated."
      helpEyebrow="What to do next"
      helpBody="Reach out to the person who shared this link and ask them to send a new one. If you had already started a session within the last few minutes, return through your original invitation instead."
    />
  );
}

export function InviteRequiredSurface() {
  return (
    <SurfaceShell
      icon={<Lock className="h-9 w-9" />}
      eyebrow="Invite required"
      title="This interview is invite-only"
      description="The recruiter has restricted this interview to invited candidates. You'll need a personal invite link to begin."
      detail="A personal invite link looks like this interview's URL but includes a unique access token. Check your email for an invitation from the recruiter."
      helpEyebrow="What to do next"
      helpBody="Open the most recent email or message from the recruiter and use the link they sent you. If you can't find an invite, reply to them and ask for one — invites are tied to a specific email address."
    />
  );
}

export function InviteInvalidSurface() {
  return (
    <SurfaceShell
      icon={<AlertCircle className="h-9 w-9" />}
      eyebrow="Invite not valid"
      title="We couldn't accept this invite"
      description="The invite link is no longer valid. It may have already been used, expired after its 24-hour window, or been revoked by the recruiter."
      detail="Invites are single-use for security — once a session is started, the link cannot be reused. If you stopped before completing the interview, a new invite is the way back in."
      helpEyebrow="What to do next"
      helpBody="Reply to the recruiter who invited you and ask for a fresh invitation. Mention if you started but did not finish — they can include a note for the hiring team."
    />
  );
}

export function InviteEmailMismatchSurface({
  onTryDifferentEmail,
}: {
  onTryDifferentEmail: () => void;
}) {
  return (
    <SurfaceShell
      icon={<MailQuestion className="h-9 w-9" />}
      eyebrow="Email mismatch"
      title="This invite is for a different email"
      description="The email you entered doesn't match the one this invite was sent to. Each invite is bound to a single email address."
      detail="A small typo is the most common cause. The invite arrived at a specific inbox — entering that same email address here will let you continue."
      helpEyebrow="What to do next"
      helpBody="Open the invitation email and use the email address it was sent to. If you've changed addresses recently, reply to the recruiter and ask for a fresh invitation sent to your current email."
      action={
        <Button
          className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
          onClick={onTryDifferentEmail}
        >
          Try a different email
        </Button>
      }
    />
  );
}

export function AccessCheckFailedSurface({
  onRetry,
}: {
  onRetry: () => void;
}) {
  return (
    <SurfaceShell
      icon={<WifiOff className="h-9 w-9" />}
      eyebrow="Connection issue"
      title="We couldn't verify your access"
      description="Something went wrong while checking whether this interview link is still active. This usually clears up after a quick retry."
      detail="Common causes: a brief drop in your network connection, or our servers being temporarily slow. Your link itself is probably fine."
      helpEyebrow="What to do next"
      helpBody="Click Retry below. If it keeps failing, check that you have a stable internet connection and try again in a minute or two. If the problem persists, contact the recruiter so they can confirm the interview is open."
      action={
        <Button
          className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
          onClick={onRetry}
        >
          Retry
        </Button>
      }
    />
  );
}

export function OwnerPreviewBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-full border border-[#e0e5d5] bg-[#fbfdf6]/95 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#203b14] shadow-[rgba(99,143,61,0.08)_0px_0px_0px_1px]">
      <ShieldCheck className="h-3.5 w-3.5" />
      Viewing as owner — gate bypassed
    </div>
  );
}
