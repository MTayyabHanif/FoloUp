import { ArrowUpRight, Copy, ExternalLink, RefreshCcw } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import Modal from "@/components/dashboard/Modal";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SharePopupProps {
  open: boolean;
  onClose: () => void;
  shareContent: string;
  interviewId: string;
  publicToken: string | null;
  publicTokenExpiresAt: string | null;
}

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
    return { label: `Expires in ${hours}h ${minutes}m`, expired: false };
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

  const [currentToken, setCurrentToken] = useState<string | null>(publicToken);
  const [currentExpiresAt, setCurrentExpiresAt] = useState<string | null>(publicTokenExpiresAt);
  const [rotating, setRotating] = useState(false);
  const [rotateDialogOpen, setRotateDialogOpen] = useState(false);

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

  const expiryInfo = useMemo(() => formatRemaining(currentExpiresAt), [currentExpiresAt]);

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
      const res = await fetch(`/api/interviews/${interviewId}/rotate-public-token`, {
        method: "POST",
      });
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
              Copy the time-limited public link or generate an embed snippet. For per-candidate
              single-use links, manage invites separately.
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

              <Link
                href={`/jobs/${interviewId}/invites`}
                className="inline-flex items-center gap-2 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2 text-sm font-semibold text-[#203b14] transition-colors hover:border-[#c5ccb6] hover:bg-[#f6f8ef]"
                onClick={onClose}
              >
                Manage invites
                <ArrowUpRight className="h-4 w-4" />
              </Link>
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
                    onChange={(event) => setEmbedHeight(Number(event.target.value))}
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
              This invalidates the current link for any new candidate. Anyone who already started an
              interview will continue uninterrupted, but new visitors with the old link will see an
              expired state. You&apos;ll need to share the new link manually.
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
    </>
  );
}

export default SharePopup;
