"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Copy,
  Mail,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { useInterviews } from "@/contexts/interviews.context";
import { getClientBaseUrl } from "@/lib/base-url";
import type { Interview } from "@/types/interview";
import type { InterviewInvite, InviteStatus } from "@/types/invite";

type InviteRow = InterviewInvite & { status: InviteStatus };

type FilterKey = "all" | InviteStatus;

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Pending",
  reserved: "Reserved",
  used: "Used",
  expired: "Expired",
  revoked: "Revoked",
};

const STATUS_BADGE_CLASS: Record<InviteStatus, string> = {
  pending: "border-[#e0e5d5] bg-[#f6f8ef] text-[#203b14]",
  reserved: "border-[#d8c9a6] bg-[#f7eedb] text-[#7d4f1f]",
  used: "border-[#cbd8b7] bg-[#dfe9c8] text-[#203b14]",
  expired: "border-[#d8d3cb] bg-[#eee9df] text-[#6f7866]",
  revoked: "border-[#d7bdb7] bg-[#f6ebe7] text-[#6b3f31]",
};

interface Props {
  params: Promise<{ interviewId: string }>;
}

function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-[#203b14] bg-[#203b14] text-[#fbfdf6]"
          : "border-[#e0e5d5] bg-[#fbfdf6] text-[#203b14] hover:bg-[#f6f8ef]"
      }`}
    >
      {children}
      <span
        className={`rounded-full px-1.5 text-[10px] font-semibold ${
          active ? "bg-[#fbfdf6]/20 text-[#fbfdf6]" : "bg-[#eef4e1] text-[#203b14]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);

  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRemaining(iso: string, status: InviteStatus): string {
  if (status === "used" || status === "revoked") {
    return "—";
  }
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) {
    return "Expired";
  }
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / (60 * 24));
  if (days >= 1) {
    return `${days}d`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) {
    return `${hours}h ${minutes % 60}m`;
  }

  return `${minutes}m`;
}

export default function InvitesPage({ params: paramsPromise }: Props) {
  const params = use(paramsPromise);
  const router = useRouter();
  const { getInterviewById } = useInterviews();

  const [interview, setInterview] = useState<Interview>();
  const [interviewError, setInterviewError] = useState(false);

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [createEmail, setCreateEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<InviteRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await getInterviewById(params.interviewId);
        if (!cancelled) {
          if (result) {
            setInterview(result);
          } else {
            setInterviewError(true);
          }
        }
      } catch (err) {
        console.error("Failed to load interview", err);
        if (!cancelled) {
          setInterviewError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.interviewId]);

  const loadInvites = useCallback(async () => {
    if (!interview) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/invites`);
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as { invites: InviteRow[] };
      setInvites(data.invites ?? []);
    } catch (err) {
      console.error("Failed to load invites", err);
      toast.error("Could not load invites.", { position: "bottom-right" });
    } finally {
      setLoading(false);
    }
  }, [interview]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: invites.length,
      pending: 0,
      reserved: 0,
      used: 0,
      expired: 0,
      revoked: 0,
    };
    for (const inv of invites) {
      c[inv.status] += 1;
    }

    return c;
  }, [invites]);

  const filteredInvites = useMemo(() => {
    const q = search.trim().toLowerCase();

    return invites.filter((inv) => {
      if (filter !== "all" && inv.status !== filter) {
        return false;
      }
      if (q && !inv.email.toLowerCase().includes(q)) {
        return false;
      }

      return true;
    });
  }, [invites, filter, search]);

  const baseShareUrl = useMemo(() => {
    if (!interview) {
      return "";
    }

    return interview.readable_slug
      ? `${getClientBaseUrl()}/call/${interview.readable_slug}`
      : (interview.url as string);
  }, [interview]);

  const buildInviteUrl = useCallback(
    (invite: InviteRow) => {
      if (!baseShareUrl) {
        return "";
      }
      const sep = baseShareUrl.includes("?") ? "&" : "?";

      return `${baseShareUrl}${sep}token=${invite.token}`;
    },
    [baseShareUrl],
  );

  const copyInviteLink = (invite: InviteRow) => {
    const url = buildInviteUrl(invite);
    if (!url) {
      return;
    }
    navigator.clipboard.writeText(url).then(
      () =>
        toast.success(`Invite link copied for ${invite.email}.`, {
          position: "bottom-right",
        }),
      (err) => console.error("Failed to copy", err.message),
    );
  };

  const handleCreate = async () => {
    const trimmed = createEmail.trim();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Enter a valid email address.", { position: "bottom-right" });

      return;
    }
    if (!interview) {
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const data = (await res.json()) as { invite: InviteRow };
      setInvites((prev) => [data.invite, ...prev]);
      setCreateEmail("");
      toast.success(`Invite created for ${trimmed}.`, {
        position: "bottom-right",
      });
    } catch (err) {
      console.error("Create invite failed", err);
      toast.error("Could not create invite.", { position: "bottom-right" });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (invite: InviteRow) => {
    if (!interview) {
      return;
    }
    try {
      const res = await fetch(
        `/api/interviews/${interview.id}/invites/${invite.id}`,
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
      console.error("Revoke failed", err);
      toast.error("Could not revoke invite.", { position: "bottom-right" });
    } finally {
      setRevokeTarget(null);
    }
  };

  if (interviewError) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Invites"
          title="Interview not found"
          description="Return to the workspace and select an interview from the dashboard."
          actions={
            <Button
              variant="ghost"
              className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell className="pb-12">
      <PageHeader
        eyebrow="Invites"
        title={interview ? `${interview.name} · Invites` : "Invites"}
        description="Send single-use invite links bound to candidate emails. Each invite expires in 24 hours."
        actions={
          <Button
            variant="ghost"
            className="rounded-full border border-[#e0e5d5] bg-[#fbfdf6] px-4 text-[#0a1d08] hover:bg-[#f6f8ef]"
            onClick={() =>
              router.push(`/interviews/${params.interviewId}`)
            }
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to workspace
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-6">
          <div className="flex flex-col gap-4 rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                active={filter === "all"}
                count={counts.all}
                onClick={() => setFilter("all")}
              >
                All
              </FilterChip>
              {(
                ["pending", "reserved", "used", "expired", "revoked"] as InviteStatus[]
              ).map((key) => (
                <FilterChip
                  key={key}
                  active={filter === key}
                  count={counts[key]}
                  onClick={() => setFilter(key)}
                >
                  {STATUS_LABEL[key]}
                </FilterChip>
              ))}

              <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6f7866]" />
                  <input
                    type="text"
                    value={search}
                    placeholder="Search by email"
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-full border border-[#e0e5d5] bg-[#fbfdf6] py-2 pl-9 pr-3 text-sm text-[#0a1d08] outline-none focus:border-[#c5ccb6]"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-[20px] border border-[#e0e5d5]">
              <div className="grid grid-cols-[minmax(0,1.6fr)_110px_minmax(0,120px)_minmax(0,90px)_120px] items-center gap-3 border-b border-[#e0e5d5] bg-[#f6f8ef] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7866]">
                <span>Candidate email</span>
                <span>Status</span>
                <span>Created</span>
                <span>Expires</span>
                <span className="text-right">Actions</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center px-4 py-12 text-sm text-[#53614d]">
                  Loading invites…
                </div>
              ) : filteredInvites.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-sm text-[#53614d]">
                  {invites.length === 0 ? (
                    <>
                      <Mail className="h-5 w-5 text-[#6f7866]" />
                      <p className="font-medium text-[#0a1d08]">
                        No invites sent yet
                      </p>
                      <p className="max-w-sm">
                        Use the panel on the right to send the first invite. Each invite is single-use, email-bound, and expires in 24 hours.
                      </p>
                    </>
                  ) : (
                    <p>No invites match the current filter.</p>
                  )}
                </div>
              ) : (
                <ul>
                  {filteredInvites.map((invite, idx) => (
                    <li
                      key={invite.id}
                      className={`grid grid-cols-[minmax(0,1.6fr)_110px_minmax(0,120px)_minmax(0,90px)_120px] items-center gap-3 px-4 py-3 text-sm text-[#0a1d08] ${
                        idx % 2 === 0 ? "bg-[#fbfdf6]" : "bg-[#f8faf3]"
                      }`}
                    >
                      <span className="min-w-0 truncate font-medium">
                        {invite.email}
                      </span>
                      <span
                        className={`inline-flex w-fit items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${STATUS_BADGE_CLASS[invite.status]}`}
                      >
                        {STATUS_LABEL[invite.status]}
                      </span>
                      <span className="text-xs text-[#53614d]">
                        {formatDateTime(invite.created_at)}
                      </span>
                      <span className="text-xs text-[#53614d]">
                        {formatRemaining(invite.expires_at, invite.status)}
                      </span>
                      <div className="flex items-center justify-end gap-1">
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
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-[#e0e5d5] bg-[#fbfdf6] p-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#6f7866]">
              Send invite
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em]">
              Invite one candidate
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#53614d]">
              Each invite is bound to the email you enter. The candidate&apos;s submitted email must match to start the interview.
            </p>
            <div className="mt-4 space-y-3">
              <input
                type="email"
                placeholder="candidate@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleCreate();
                  }
                }}
                className="w-full rounded-[18px] border border-[#d8ddd0] bg-[#fbfdf6] px-4 py-3 text-sm text-[#0a1d08] outline-none focus:border-[#c5ccb6]"
              />
              <Button
                disabled={creating || !createEmail.trim()}
                className="w-full rounded-full bg-[#4a3212] px-5 text-[#fbfdf6] hover:bg-[#3d2910] disabled:opacity-60"
                onClick={() => void handleCreate()}
              >
                {creating ? "Creating…" : "Create invite"}
              </Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-dashed border-[#c5ccb6] bg-[#f6f8ef] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e0e5d5] bg-[#fbfdf6] text-[#203b14]">
                <Upload className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0a1d08]">
                  Bulk import (coming soon)
                </p>
                <p className="mt-1 text-xs leading-5 text-[#53614d]">
                  Upload a CSV with names and emails to send dozens of invites at once. We&apos;ll surface progress, failed rows, and a per-candidate status here.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

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
    </PageShell>
  );
}
