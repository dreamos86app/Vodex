"use client";

import * as React from "react";
import { Circle, Loader2, Radio } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { PresenceMode } from "@/lib/presence/user-presence";
import { usePresenceStore } from "@/lib/stores/presence-store";

const OPTIONS: Array<{
  mode: PresenceMode;
  title: string;
  description: string;
}> = [
  {
    mode: "auto",
    title: "Automatic",
    description: "Online while active, away when idle.",
  },
  {
    mode: "online",
    title: "Online",
    description: "Always show as online while signed in.",
  },
  {
    mode: "offline",
    title: "Offline",
    description: "Show as offline until you change this.",
  },
];

export function PresenceSettingsSection() {
  const { presenceMode, loaded, setSnapshot } = usePresenceStore();
  const [saving, setSaving] = React.useState<PresenceMode | null>(null);

  React.useEffect(() => {
    if (loaded) return;
    void fetch("/api/user/presence/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json) return;
        setSnapshot({
          presenceMode: json.presenceMode,
          visibleStatus: json.visibleStatus,
          label: json.label,
        });
      })
      .catch(() => undefined);
  }, [loaded, setSnapshot]);

  async function selectMode(mode: PresenceMode) {
    if (mode === presenceMode || saving) return;
    setSaving(mode);
    try {
      const res = await fetch("/api/user/presence/mode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        presenceMode?: PresenceMode;
        visibleStatus?: "online" | "offline";
        label?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not update status");
      setSnapshot({
        presenceMode: json.presenceMode ?? mode,
        visibleStatus: json.visibleStatus ?? "offline",
        label: json.label ?? "Offline",
      });
      toast.success("Status updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card data-testid="presence-settings">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Circle className="size-4 text-accent" strokeWidth={1.55} />
          <div>
            <CardTitle>Status</CardTitle>
            <CardDescription>Choose how you appear to teammates across Vodex.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {OPTIONS.map((opt) => {
          const selected = presenceMode === opt.mode;
          const busy = saving === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              disabled={Boolean(saving)}
              onClick={() => void selectMode(opt.mode)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition",
                selected
                  ? "border-accent/40 bg-accent/[0.06] ring-1 ring-accent/20"
                  : "border-border bg-background hover:bg-muted/40",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-accent bg-accent text-white" : "border-border bg-muted/50 text-transparent",
                )}
              >
                {busy ? (
                  <Loader2 className="size-3 animate-spin text-white" />
                ) : selected ? (
                  <Radio className="size-3 fill-current" strokeWidth={2.5} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-foreground">{opt.title}</span>
                <span className="mt-0.5 block text-[12px] leading-relaxed text-muted-foreground">
                  {opt.description}
                </span>
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
