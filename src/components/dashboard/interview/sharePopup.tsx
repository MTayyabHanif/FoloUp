import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Info, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Modal from "@/components/dashboard/Modal";
import type { InterviewInvite, InviteStatus } from "@/types/invite";

interface SharePopupProps {
  open: boolean;
  onClose: () => void;
  shareContent: string;
  interviewId: string;
  publicToken: string | null;
  publicTokenExpiresAt: string | null;
}

type InviteRow = InterviewInvite & { status: InviteStatus };

const statusBadgeClass: Record<InviteStatus, string> = {
  pending: "border-[#e0e5d5] bg-[#f6f8ef] text-[#203b14]",
  reserved: "border-[#d8c9a6] bg-[#f7eedb] text-[#7d4f1f]",
  used: "border-[#cbd8b7] bg-[#dfe9c8] text-[#203b14]",
  expired: "border-[#d8d3cb] bg-[#eee9df] text-[#6f7866]",
  revoked: "border-[#d7bdb7] bg-[#f6ebe7] text-[#6b3f31]",
};

function formatRemaining(expiresAtIso: string | null): {
  label: string;
  expired: boolean;
} {
  if (!expiresAtIso) {
    return { label: "No expiry recorded", expired: true };
  }
  const expiresAt = new Date(expiresAtIso).getTime();
  const now = Date.now();
  const diff = expiresAt - now;
  if (diff <= 0) {
    return { label: "Expired — rotate the link to share again", expired: true };
  }
  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  if (days >= 1) {
    return { label: `Expires in ${days} day${days === 1 ? "" : "s"}`, expired: false };
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 1) {
    return {
      label: `Expires in ${hours}h ${minutes}m`,
      expired: false,
    };
  }

  return { label: `Expires in ${minutes}m`, expired: false };
}

function SharePopup({
  open,
  onClose,
  shareContent,
  interviewId,
  publicToken,
  publicTokenExpiresAt,
}: SharePopupProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [url, setUrl] = useState<string>("Loading...");
  const [embedCode, setEmbedCode] = useState<string>("Loading...");
  const [activeTab, setActiveTab] = useState("copy");
  const [embedWidth, setEmbedWidth] = useState(1350);
  const [embedHeight, setEmbedHeight] = useState(735);

  // Public-link state — rotation updates these in place without a parent refetch.
  const [currentToken, setCurrentToken] = useState<string | null>(publicToken);
  const [currentExpiresAt, setCurrentExpiresAt] = useState<string | null>(
    publicTokenExpiresAt,
  );
  const [rotating, setRotating] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);

  // Invite-management state.
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<InviteRow | null>(null);

  useEffect(() => {
    setCurrentToken(publicToken);
    setCurrentExpiresAt(publicTokenExpiresAt);
  }, [publicToken, publicTokenExpiresAt]);

  const publicShareUrl = useMemo(() => {
    if (!shareContent) {
      return "";
    }
    if (!currentToken) {
      return shareContent;
    }
    const separator = shareContent.includes("?") ? "&" : "?";

    return `${shareContent}${separator}token=${currentToken}`;
  }, [shareContent, currentToken]);

  useEffect(() => {
    if (!publicShareUrl) {
      return;
    }
    setUrl(publicShareUrl);
    setEmbedCode(
      `<iframe src="${publicShareUrl}" width="${embedWidth}" height="${embedHeight}"></iframe>`,
    );
  }, [publicShareUrl, embedWidth, embedHeight]);

  const expiryInfo = useMemo(
    () => formatRemaining(currentExpiresAt),
    [currentExpiresAt],
  );

  const loadInvites = useCallback(async () => {
    if (!interviewId) {
      return;
    }
    setInvitesLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/invites`);
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as { invites: InviteRow[] };
      setInvites(data.invites ?? []);
    } catch (err) {
      console.error("loadInvites failed", err);
      toast.error("Could not load invites.", {
        position: "bottom-right",
      });
    } finally {
      setInvitesLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    if (!open || activeTab !== "invites") {
      return;
    }
    void loadInvites();
  }, [open, activeTab, loadInvites]);

  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(url).then(
      () => {
        setCopiedLink(true);
        toast.success("Interview URL copied.", {
          position: "bottom-right",
          duration: 2500,
        });
        setTimeout(() => setCopiedLink(false), 1600);
      },
      (error) => console.error("Failed to copy", error.message),
    );
  };

  const copyEmbedToClipboard = () => {
    navigator.clipboard.writeText(embedCode).then(
      () => {
        setCopiedEmbed(true);
        toast.success("Embed code copied.", {
          position: "bottom-right",
          duration: 2500,
        });
        setTimeout(() => setCopiedEmbed(false), 1600);
      },
      (error) => console.error("Failed to copy", error.message),
    );
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const res = await fetch(
        `/api/interviews/${interviewId}/rotate-public-token`,
        { method: "POST" },
      );
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as {
        public_token: string;
        public_token_expires_at: string;
      };
      setCurrentToken(data.public_token);
      setCurrentExpiresAt(data.public_token_expires_at);
      toast.success("Public link rotated. Share the new URL with candidates.", {
        position: "bottom-right",
        duration: 3000,
      });
    } catch (err) {
      console.error("rotate failed", err);
      toast.error("Could not rotate link. Try again.", {
        position: "bottom-right",
      });
    } finally {
      setRotating(false);
      setRotateDialogOpen(false);
    }
  };

  const buildInviteUrl = useCallback(
    (invite: InviteRow) => {
      if (!shareContent) {
        return "";
      }
      const separator = shareContent.includes("?") ? "&" : "?";

      return `${shareContent}${separator}token=${invite.token}`;
    },
    [shareContent],
  );

  const handleCreateInvite = async () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Enter a valid email address.", {
        position: "bottom-right",
      });

      return;
    }
    setCreatingInvite(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as { invite: InviteRow };
      setInvites((prev) => [data.invite, ...prev]);
      setInviteEmail("");
      toast.success(`Invite created for ${trimmed}.`, {
        position: "bottom-right",
      });
    } catch (err) {
      console.error("createInvite failed", err);
      toast.error("Could not create invite.", {
        position: "bottom-right",
      });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevoke = async (invite: InviteRow) => {
    try {
      const res = await fetch(
        `/api/interviews/${interviewId}/invites/${invite.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      setInvites((prev) =>
        prev.map((row) =>
          row.id === invite.id
            ? { ...row, revoked_at: new Date().toISOString(), status: "revoked" }
            : row,
        ),
      );
      toast.success("Invite revoked.", { position: "bottom-right" });
    } catch (err) {
      console.error("revoke failed", err);
      toast.error("Could not revoke invite.", { position: "bottom-right" });
    } finally {
      setRevokeTarget(null);
    }
  };

  const copyInviteLink = (invite: InviteRow) => {
    const inviteUrl = buildInviteUrl(invite);
    if (!inviteUrl) {
      return;
    }
    navigator.clipboard.writeText(inviteUrl).then(
      () => {
        toast.success(`Invite link copied for ${invite.email}.`, {
          position: "bottom-right",
        });
      },
      (error) => console.error("Failed to copy invite link", error.message),
    );
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <Modal open={open} size="md" closeOnOutsideClick={false} onClose={onClose}>
        <div className="flex w-full flex-col gap-6 rounded-[28px] bg-[#fbfdf6] p-1 text-[#0a1d08]">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
              Share workflow
            </p>
            <h3 className="text-3xl font-semibold tracking-[-0.05em]">
              Send this interview anywhere
            </h3>
            <p className="max-w-lg text-sm leading-6 text-[#53614d]">
              Copy the time-limited public link, manage per-candidate invites, or generate an embed snippet.
            </p>
          </div>

          <Tabs
            value={activeTab}
            className="flex h-full flex-col gap-5"
            onValueChange={setActiveTab}
          >
            <TabsList className="inline-flex h-auto rounded-full border border-[#e0e5d5] bg-[#f6f8ef] p-1">
              <TabsTrigger
                value="copy"
                className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-[#fbfdf6] data-[state=active]:text-[#0a1d08]"
              >
                Share link
              </TabsTrigger>
              <TabsTrigger
                value="invites"
                className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-[#fbfdf6] data-[state=active]:text-[#0a1d08]"
              >
                Invites
              </TabsTrigger>
              <TabsTrigger
                value="embed"
                className="rounded-full px-4 py-2 text-sm data-[state=active]:bg-[#fbfdf6] data-[state=active]:text-[#0a1d08]"
              >
                Embed
              </TabsTrigger>
            </TabsList>

            <TabsContent value="copy" className="m-0 space-y-4">
              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f6f8ef] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-[#0a1d08]">Candidate URL</p>
                  <p
                    className={`text-xs font-medium ${
                      expiryInfo.expired ? "text-[#6b3f31]" : "text-[#53614d]"
                    }`}
                  >
                    {expiryInfo.label}
                  </p>
                </div>
                <input
                  type="text"
                  value={url}
                  className="w-full rounded-[18px] border border-[#d8ddd0] bg-[#fbfdf6] px-4 py-3 text-sm text-[#0a1d08] outline-none"
                  readOnly
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
                  onClick={copyLinkToClipboard}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {copiedLink ? "Copied" : "Copy URL"}
                </Button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] px-5 py-2.5 text-sm font-semibold text-[#0a1d08] transition-colors hover:border-[#c5ccb6] hover:bg-[#f6f8ef]"
                >
                  Preview link
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Button
                  variant="ghost"
                  disabled={rotating}
                  className="rounded-full border border-[#d7bdb7] bg-[#f6ebe7] px-5 text-[#6b3f31] hover:bg-[#f0dfd8]"
                  onClick={() => setRotateDialogOpen(true)}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Rotate link
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="invites" className="m-0 space-y-4">
              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f6f8ef] p-4">
                <p className="mb-2 text-sm font-medium text-[#0a1d08]">
                  Send a single-use invite
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    placeholder="candidate@example.com"
                    value={inviteEmail}
                    className="flex-1 rounded-[18px] border border-[#d8ddd0] bg-[#fbfdf6] px-4 py-3 text-sm text-[#0a1d08] outline-none"
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                  <Button
                    className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
                    disabled={creatingInvite}
                    onClick={handleCreateInvite}
                  >
                    {creatingInvite ? "Creating..." : "Create invite"}
                  </Button>
                </div>
                <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#53614d]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    Invites are single-use and expire in 24 hours. They work in both modes — enable invite-only in the interview settings to require an invite.
                  </p>
                </div>
              </div>

              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#fbfdf6] p-4">
                <p className="mb-3 text-sm font-medium text-[#0a1d08]">Sent invites</p>
                {invitesLoading ? (
                  <p className="text-sm text-[#53614d]">Loading...</p>
                ) : invites.length === 0 ? (
                  <p className="text-sm text-[#53614d]">
                    No invites sent yet. Send one above to track individual candidates.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {invites.map((invite) => (
                      <li
                        key={invite.id}
                        className="flex items-center justify-between gap-3 rounded-[16px] border border-[#e0e5d5] bg-[#f8faf3] px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#0a1d08]">
                            {invite.email}
                          </p>
                          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-[#6f7866]">
                            Created {new Date(invite.created_at).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusBadgeClass[invite.status]}`}
                        >
                          {invite.status}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {invite.status === "pending" ? (
                            <Button
                              variant="ghost"
                              className="rounded-full px-2 py-1 text-xs text-[#203b14] hover:bg-[#eef4e1]"
                              onClick={() => copyInviteLink(invite)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {invite.status === "used" ? null : (
                            <Button
                              variant="ghost"
                              className="rounded-full px-2 py-1 text-xs text-[#6b3f31] hover:bg-[#f6ebe7]"
                              onClick={() => {
                                if (invite.status === "reserved") {
                                  setRevokeTarget(invite);
                                } else {
                                  void handleRevoke(invite);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="embed" className="m-0 space-y-4">
              <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f6f8ef] p-4">
                <p className="mb-2 text-sm font-medium text-[#0a1d08]">Embed code</p>
                <textarea
                  value={embedCode}
                  className="min-h-[110px] w-full rounded-[18px] border border-[#d8ddd0] bg-[#fbfdf6] px-4 py-3 text-sm text-[#0a1d08] outline-none"
                  readOnly
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-[#53614d]">
                  <span>Width (px)</span>
                  <input
                    type="number"
                    min="1050"
                    value={embedWidth}
                    className="w-full rounded-[18px] border border-[#d8ddd0] bg-[#fbfdf6] px-4 py-3 text-sm text-[#0a1d08] outline-none"
                    onChange={(event) => setEmbedWidth(Number(event.target.value))}
                    onBlur={(event) => {
                      const value = Math.max(1050, Number(event.target.value));
                      setEmbedWidth(value);
                    }}
                  />
                </label>
                <label className="space-y-2 text-sm text-[#53614d]">
                  <span>Height (px)</span>
                  <input
                    type="number"
                    min="700"
                    value={embedHeight}
                    className="w-full rounded-[18px] border border-[#d8ddd0] bg-[#fbfdf6] px-4 py-3 text-sm text-[#0a1d08] outline-none"
                    onChange={(event) =>
                      setEmbedHeight(Number(event.target.value))
                    }
                    onBlur={(event) => {
                      const value = Math.max(700, Number(event.target.value));
                      setEmbedHeight(value);
                    }}
                  />
                </label>
              </div>
              <Button
                className="rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910]"
                onClick={copyEmbedToClipboard}
              >
                <Copy className="mr-2 h-4 w-4" />
                {copiedEmbed ? "Copied" : "Copy embed code"}
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </Modal>

      <AlertDialog open={rotateDialogOpen} onOpenChange={setRotateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate public link?</AlertDialogTitle>
            <AlertDialogDescription>
              This invalidates the current link for any new candidate. Anyone who already started an interview will continue uninterrupted, but new visitors with the old link will see an expired state. You&apos;ll need to share the new link manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#6b3f31] text-[#fbfdf6] hover:bg-[#5a3429]"
              disabled={rotating}
              onClick={async () => {
                await handleRotate();
              }}
            >
              {rotating ? "Rotating..." : "Rotate link"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invite?</AlertDialogTitle>
            <AlertDialogDescription>
              A candidate may be partway through entering the interview. Revoking will prevent them from starting if they haven&apos;t yet, but won&apos;t interrupt an active session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#6b3f31] text-[#fbfdf6] hover:bg-[#5a3429]"
              onClick={async () => {
                if (revokeTarget) {
                  await handleRevoke(revokeTarget);
                }
              }}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SharePopup;
