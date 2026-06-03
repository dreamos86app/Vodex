"use client";

import * as React from "react";
import { Users, Loader2, X } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { PresenceDot } from "@/components/presence/presence-dot";
import type { VisiblePresenceStatus } from "@/lib/presence/user-presence";

type TeamMember = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  is_you: boolean;
  visible_status?: VisiblePresenceStatus;
};

export function QuickCollaboratorPopover() {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"editor" | "viewer">("editor");
  const [scope, setScope] = React.useState<"workspace" | "app">("workspace");
  const [busy, setBusy] = React.useState(false);
  const [workspaceId, setWorkspaceId] = React.useState<string | null>(null);
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setLoadingMembers(true);
    void fetch("/api/team", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { workspace_id?: string; members?: TeamMember[] } | null) => {
        if (json?.workspace_id) setWorkspaceId(json.workspace_id);
        setMembers(json?.members ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMembers(false));
  }, [open]);

  async function invite() {
    if (!email.trim() || !workspaceId) {
      toast.error("Enter an email and ensure you have a workspace");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Invite failed");
      toast.success("Invitation sent");
      setEmail("");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  const teammates = members.filter((m) => !m.is_you).slice(0, 6);

  return (
    <div className="relative" data-testid="quick-collaborator-popover">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
        aria-label="Invite collaborators"
      >
        <Users className="size-[18px]" strokeWidth={1.65} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80]"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-[90] mt-2 w-[min(100vw-2rem,320px)] overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-[13px] font-semibold text-foreground">Invite collaborators</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Usage is billed to this workspace owner — not collaborator accounts.
              </p>

              {loadingMembers ? (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Loading workspace…
                </div>
              ) : teammates.length > 0 ? (
                <div className="rounded-xl border border-border/80 bg-muted/20 px-3 py-2">
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    In workspace
                  </p>
                  <ul className="space-y-1.5">
                    {teammates.map((m) => (
                      <li key={m.user_id} className="flex items-center gap-2 text-[12px]">
                        <PresenceDot status={m.visible_status ?? "offline"} size="sm" />
                        <span className="truncate text-foreground">
                          {m.display_name || m.email?.split("@")[0] || "Member"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <label className="block text-[11px] font-medium text-muted-foreground">
                Scope
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as "workspace" | "app")}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]"
                >
                  <option value="workspace">Whole workspace</option>
                  <option value="app">This app (via workspace access)</option>
                </select>
              </label>
              <label className="block text-[11px] font-medium text-muted-foreground">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                />
              </label>
              <label className="block text-[11px] font-medium text-muted-foreground">
                Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "editor" | "viewer")}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[12px]"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <p className="text-[10px] text-muted-foreground">Owner role cannot be assigned via invite.</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void invite()}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-white",
                  busy && "opacity-70",
                )}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : "Send invite"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
