"use client";

import {
  Eye,
  MailPlus,
  MoreHorizontal,
  Palette,
  Pencil,
  Share2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HeaderActionsProps = {
  isActive: boolean;
  currentPlan: string;
  onShare: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onPreview: () => void;
  onOpenMarker: () => void;
  onManageInvites: () => void;
};

export function HeaderActions({
  isActive,
  currentPlan,
  onShare,
  onEdit,
  onToggleActive,
  onPreview,
  onOpenMarker,
  onManageInvites,
}: HeaderActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
        variant="ghost"
        onClick={onShare}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
      <Button
        className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
        variant="ghost"
        onClick={onEdit}
      >
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>

      <div className="flex items-center gap-3 rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 py-2">
        {currentPlan === "free_trial_over" ? (
          <span className="text-sm text-[#6f7866]">Inactive</span>
        ) : (
          <>
            <span className="text-sm text-[#53614d]">
              {isActive ? "Active" : "Inactive"}
            </span>
            <Switch
              checked={isActive}
              aria-label="Toggle interview active"
              onCheckedChange={onToggleActive}
            />
          </>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-3 text-[#0a1d08] hover:bg-[#f6f8ef]"
            variant="ghost"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={onManageInvites}>
            <MailPlus className="mr-2 h-4 w-4" />
            Manage invites
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onPreview}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenMarker}>
            <Palette className="mr-2 h-4 w-4" />
            Identity marker
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default HeaderActions;
