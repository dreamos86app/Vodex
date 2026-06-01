"use client";

import * as React from "react";
import { AtSign, Loader2, Mail, Send, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { selectCls } from "@/components/settings/shared";
import { toast } from "@/lib/toast";

type ApiInvite = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

function isValidEmail(email: string): boolean {
  const t = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
}

type Props = {
  workspaceId: string | null;
  onInvited?: (invite: ApiInvite) => void;
};

export function TeamInvitePanel({ workspaceId, onInvited }: Props) {
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("editor");
  const [sending, setSending] = React.useState(false);

  const emailOk = isValidEmail(inviteEmail);
  const normalized = inviteEmail.trim().toLowerCase();

  async function handleInvite() {
    if (!emailOk || !workspaceId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, role: inviteRole }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        invite?: ApiInvite;
        email_sent?: boolean;
      };
      if (!res.ok) throw new Error(j.error ?? "Invite failed");
      setInviteEmail("");
      if (j.invite) onInvited?.(j.invite);
      toast.success(
        j.email_sent
          ? `Invitation sent to ${normalized}`
          : `Invitation created for ${normalized} (email not configured)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-500/[0.07] via-background to-indigo-500/[0.05] p-[1px] shadow-[var(--shadow-sm)]">
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-violet-500/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 size-28 rounded-full bg-indigo-500/10 blur-2xl" />
      <div className="relative rounded-[calc(var(--radius-xl)-1px)] bg-background/95 p-5 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md ring-1 ring-white/10">
            <UserPlus className="size-5" strokeWidth={1.8} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
                Invite by email
              </h3>
              <Sparkles className="size-3.5 text-violet-400" strokeWidth={1.8} />
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Send a Gmail or work email invite. By default, teammates use their own AI credits unless
              you enable workspace-sponsored billing below.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative min-w-0 flex-1">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70"
              strokeWidth={1.6}
            />
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="teammate@gmail.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && emailOk && void handleInvite()}
              className="h-11 border-border/80 bg-background/80 pl-10 text-[14px] shadow-inner"
            />
            {inviteEmail.length > 0 && !emailOk ? (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-destructive">
                <AtSign className="size-3" />
                Enter a valid email address
              </p>
            ) : null}
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className={cn(selectCls, "h-11 sm:w-36")}
            aria-label="Invite role"
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            variant="accent"
            size="md"
            className="h-11 gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 px-5 shadow-md hover:from-violet-500 hover:to-indigo-500"
            onClick={() => void handleInvite()}
            disabled={!emailOk || sending || !workspaceId}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.6} />
            ) : (
              <Send className="size-4" strokeWidth={1.6} />
            )}
            Send invite
          </Button>
        </div>
      </div>
    </div>
  );
}
