import React, { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Modal from "@/components/dashboard/Modal";

interface SharePopupProps {
  open: boolean;
  onClose: () => void;
  shareContent: string;
}

function SharePopup({ open, onClose, shareContent }: SharePopupProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [url, setUrl] = useState<string>("Loading...");
  const [embedCode, setEmbedCode] = useState<string>("Loading...");
  const [activeTab, setActiveTab] = useState("copy");
  const [embedWidth, setEmbedWidth] = useState(1350);
  const [embedHeight, setEmbedHeight] = useState(735);

  useEffect(() => {
    if (!shareContent) {
      return;
    }

    setUrl(shareContent);
    setEmbedCode(
      `<iframe src="${shareContent}" width="${embedWidth}" height="${embedHeight}"></iframe>`,
    );
  }, [shareContent, embedWidth, embedHeight]);

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

  if (!open) {
    return null;
  }

  return (
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
            Copy the direct candidate link or generate an embed snippet for your own site.
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
              <p className="mb-2 text-sm font-medium text-[#0a1d08]">
                Candidate URL
              </p>
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
            </div>
          </TabsContent>

          <TabsContent value="embed" className="m-0 space-y-4">
            <div className="rounded-[22px] border border-[#e0e5d5] bg-[#f6f8ef] p-4">
              <p className="mb-2 text-sm font-medium text-[#0a1d08]">
                Embed code
              </p>
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
  );
}

export default SharePopup;
