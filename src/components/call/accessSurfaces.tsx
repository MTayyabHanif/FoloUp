"use client";

import type { ReactNode } from "react";
import { AlertCircle, Clock3, Lock, MailQuestion, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

function SurfaceShell({
  icon,
  eyebrow,
  title,
  description,
  detail,
  action,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
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
              Guided experience
            </p>
            <p className="mt-3 text-sm leading-6 text-[#31200b]/72">
              The candidate flow stays focused on clarity, readiness, and a
              calm next step.
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
      description="Share links automatically expire to keep candidate access fresh. Ask the recruiter to send a new link when they're ready."
      detail="If you've started a session within the last few minutes, you can return to it from your original invitation. Otherwise, request a fresh link to continue."
    />
  );
}

export function InviteRequiredSurface() {
  return (
    <SurfaceShell
      icon={<Lock className="h-9 w-9" />}
      eyebrow="Invite required"
      title="This interview is invite-only"
      description="The recruiter has restricted access to invited candidates. You'll need an invite link sent directly to your email to begin."
      detail="Check your inbox for an invitation from the recruiter. The invite link will include a unique token that grants you access."
    />
  );
}

export function InviteInvalidSurface() {
  return (
    <SurfaceShell
      icon={<AlertCircle className="h-9 w-9" />}
      eyebrow="Invite not valid"
      title="We couldn't verify this invite"
      description="The invite link is no longer valid. It may have already been used, revoked, or expired."
      detail="Invites are single-use and time-limited. If you believe this is a mistake, reach out to the recruiter to request a new invitation."
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
      description="The email you entered doesn't match the invite. Double-check the email you received the invite at, or contact the recruiter."
      detail="Each invite is bound to a specific email address for verification. Try entering the email the invitation was sent to."
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

export function OwnerPreviewBanner() {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-full border border-[#e0e5d5] bg-[#fbfdf6]/95 px-4 py-2 text-[12px] font-medium uppercase tracking-[0.18em] text-[#203b14] shadow-[rgba(99,143,61,0.08)_0px_0px_0px_1px]">
      <ShieldCheck className="h-3.5 w-3.5" />
      Viewing as owner — gate bypassed
    </div>
  );
}
