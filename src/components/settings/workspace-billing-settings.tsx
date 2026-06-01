"use client";

import * as React from "react";
import { Loader2, Wallet, Building2, Shuffle } from "lucide-react";
import { SectionCard } from "@/components/settings/shared";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

type BillingMode = "personal_credits" | "workspace_sponsored" | "hybrid";

const OPTIONS: {
  id: BillingMode;
  title: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    id: "personal_credits",
    title: "Members use their own credits",
    description:
      "Default and recommended. Each teammate pays for their own AI builds, edits, and actions.",
    icon: Wallet,
  },
  {
    id: "workspace_sponsored",
    title: "Workspace pays for member usage",
    description:
      "AI usage is charged to the workspace owner’s credit balance. Use for teams with a shared budget.",
    icon: Building2,
  },
  {
    id: "hybrid",
    title: "Hybrid",
    description:
      "Use each member’s credits first. If they run out, fall back to the workspace owner’s balance when available.",
    icon: Shuffle,
  },
];

type Props = {
  workspaceId: string | null;
  canManage?: boolean;
};

export function WorkspaceBillingSettings({ workspaceId, canManage = false }: Props) {
  const [mode, setMode] = React.useState<BillingMode>("personal_credits");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/billing`, {
          credentials: "include",
        });
        const j = (await res.json()) as { billing_mode?: BillingMode; error?: string };
        if (!res.ok) throw new Error(j.error ?? "Could not load billing settings");
        if (j.billing_mode) setMode(j.billing_mode);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load billing settings");
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  async function select(next: BillingMode) {
    if (!workspaceId || !canManage || next === mode) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/billing`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing_mode: next }),
      });
      const j = (await res.json()) as { billing_mode?: BillingMode; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Could not update billing mode");
      setMode(j.billing_mode ?? next);
      toast.success("Workspace billing mode updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard
      title="Workspace AI billing"
      description="Controls whose credits are used when teammates run AI in this workspace. Server-enforced — the UI cannot spoof billing targets."
    >
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading billing mode…
        </div>
      ) : !workspaceId ? (
        <p className="text-[13px] text-muted-foreground">No workspace found for your account.</p>
      ) : (
        <div className="space-y-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={!canManage || saving}
                onClick={() => void select(opt.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-150",
                  selected
                    ? "border-accent/50 bg-accent/5 ring-1 ring-accent/30"
                    : "border-border bg-background hover:border-border/80 hover:bg-muted/30",
                  !canManage && "cursor-default opacity-90",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1",
                    selected ? "bg-accent/15 ring-accent/40" : "bg-muted ring-border",
                  )}
                >
                  <Icon
                    className={cn("size-4", selected ? "text-accent" : "text-muted-foreground")}
                    strokeWidth={1.6}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-3.5 shrink-0 rounded-full border-2",
                        selected ? "border-accent bg-accent" : "border-muted-foreground/40",
                      )}
                      aria-hidden
                    />
                    <p className="text-[13px] font-medium text-foreground">{opt.title}</p>
                  </div>
                  <p className="mt-1 pl-5 text-[12px] leading-relaxed text-muted-foreground">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
          {!canManage ? (
            <p className="pt-2 text-[12px] text-muted-foreground">
              Only the workspace owner can change billing mode.
            </p>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
