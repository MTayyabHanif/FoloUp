"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkflowStage } from "@/lib/hiring-workflow";

export type SessionSortKey = "recency" | "score" | "name" | "stage";

export type StageChip = {
  key: "all" | WorkflowStage;
  label: string;
  count: number;
};

type SessionsToolbarProps = {
  query: string;
  onQueryChange: (next: string) => void;
  stageChips: StageChip[];
  railFilter: "all" | WorkflowStage;
  onRailFilterChange: (next: "all" | WorkflowStage) => void;
  sortKey: SessionSortKey;
  onSortKeyChange: (next: SessionSortKey) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (next: boolean) => void;
};

export function SessionsToolbar({
  query,
  onQueryChange,
  stageChips,
  railFilter,
  onRailFilterChange,
  sortKey,
  onSortKeyChange,
  unreadOnly,
  onUnreadOnlyChange,
}: SessionsToolbarProps) {
  return (
    <div className="z-10 space-y-3 border-b border-[#e0e5d5] bg-[#fbfdf6] px-3 pb-3 pt-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f7866]" />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search candidates"
          aria-label="Search candidates"
          className="h-10 pl-9"
        />
      </div>

      <div
        role="group"
        aria-label="Filter by stage"
        className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stageChips.map((chip) => {
          const active = railFilter === chip.key;

          return (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active}
              onClick={() => onRailFilterChange(chip.key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                active
                  ? "border-[#203b14] bg-[#203b14] text-[#fbfdf6]"
                  : "border-[#e0e5d5] bg-[#fbfdf6] text-[#0a1d08] hover:border-[#c5ccb6] hover:bg-[#f3f7ea]"
              }`}
            >
              <span>{chip.label}</span>
              <span
                className={`inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 text-[10px] ${
                  active
                    ? "bg-[#fbfdf6]/15 text-[#fbfdf6]"
                    : "bg-[#eef1e3] text-[#53614d]"
                }`}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Select
          value={sortKey}
          onValueChange={(value) => onSortKeyChange(value as SessionSortKey)}
        >
          <SelectTrigger
            aria-label="Sort sessions"
            className="h-9 w-[160px] rounded-full border-[#e0e5d5] bg-[#fbfdf6]"
          >
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recency">Sort: Recency</SelectItem>
            <SelectItem value="score">Sort: Score</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="stage">Sort: Stage</SelectItem>
          </SelectContent>
        </Select>

        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0a1d08]">
          <Switch
            checked={unreadOnly}
            onCheckedChange={onUnreadOnlyChange}
            aria-label="Show only unread candidates"
          />
          Unread only
        </label>
      </div>
    </div>
  );
}

export default SessionsToolbar;
