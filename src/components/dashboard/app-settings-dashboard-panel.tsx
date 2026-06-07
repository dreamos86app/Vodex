"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronDown, Lock, Wrench } from "lucide-react";
import { SectionCard, SettingRow } from "@/components/settings/shared";
import { Switch } from "@/components/ui/switch";
import { AppSettingsInlineForm } from "@/components/create/workspace/app-settings-inline-form";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { getEntitlements } from "@/lib/billing/plan-entitlements";
import { fetchDedupe } from "@/lib/cache/fetch-dedupe";

export function AppSettingsDashboardPanel({
  projectId,
  planId,
  displayName,
  displayDesc,
  iconSrc,
  onSaved,
  advancedContent,
}: {
  projectId: string;
  planId: string;
  displayName: string;
  displayDesc: string;
  iconSrc?: string | null | undefined;
  onSaved: () => void;
  advancedContent: React.ReactNode;
}) {
  const [watermarkDisabled, setWatermarkDisabled] = React.useState(false);
  const [watermarkLoading, setWatermarkLoading] = React.useState(true);
  const [watermarkSaving, setWatermarkSaving] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const canHideWatermark = getEntitlements(planId).tier !== "free";

  React.useEffect(() => {
    void fetchDedupe(`watermark:${projectId}`, (signal) =>
      fetch(`/api/projects/${projectId}/watermark`, { credentials: "include", signal }).then((r) => r.json()),
    )
      .then((json) => {
        const body = json as { watermarkDisabled?: boolean };
        setWatermarkDisabled(Boolean(body.watermarkDisabled));
      })
      .catch(() => setWatermarkDisabled(false))
      .finally(() => setWatermarkLoading(false));
  }, [projectId]);

  async function toggleWatermark(next: boolean) {
    if (!canHideWatermark && next) return;
    setWatermarkSaving(true);
    const prev = watermarkDisabled;
    setWatermarkDisabled(next);
    try {
      const res = await fetch(`/api/projects/${projectId}/watermark`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watermarkDisabled: next }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      toast.success(next ? "Watermark hidden on published app" : "Watermark enabled");
    } catch (e) {
      setWatermarkDisabled(prev);
      toast.error(e instanceof Error ? e.message : "Could not update watermark");
    } finally {
      setWatermarkSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="app-settings-dashboard-panel">
      <SectionCard title="General" description="Name, description, and icon shown across dashboard and publish flows.">
        <AppSettingsInlineForm
          projectId={projectId}
          initialName={displayName}
          initialDescription={displayDesc}
          iconSrc={iconSrc ?? ""}
          onSaved={onSaved}
        />
      </SectionCard>

      <SectionCard title="Watermark" description="Small “Made with Vodex” footer link on your published app.">
        <div className="rounded-xl bg-muted/30 p-4 ring-1 ring-border/60">
          <p className="text-[11px] font-medium text-muted-foreground">Published footer preview</p>
          <div className="mt-3 min-h-[72px] rounded-lg bg-background px-4 py-6 text-center ring-1 ring-border/50">
            <span className="text-[11px] text-muted-foreground">Your app content</span>
            <div className="mt-6 border-t border-border/40 pt-3">
              {!watermarkDisabled || !canHideWatermark ? (
                <a
                  href="https://vodex.dev"
                  className="text-[12px] font-medium text-foreground/80 underline-offset-2 hover:underline"
                  onClick={(e) => e.preventDefault()}
                >
                  Made with Vodex
                </a>
              ) : (
                <span className="text-[11px] text-emerald-600">Watermark hidden</span>
              )}
            </div>
          </div>
        </div>
        {watermarkLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted/40" />
        ) : canHideWatermark ? (
          <SettingRow
            title="Hide watermark"
            description="Remove the Vodex badge from your published app footer."
            border={false}
          >
            <Switch
              checked={watermarkDisabled}
              disabled={watermarkSaving}
              onCheckedChange={(v) => void toggleWatermark(v)}
            />
          </SettingRow>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-gradient-to-br from-violet-500/10 to-background px-4 py-4 ring-1 ring-violet-500/20"
          >
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 size-5 text-violet-600" />
              <div>
                <p className="text-[13px] font-semibold">Starter+ unlocks watermark removal</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Free plans always show the Vodex badge on published apps.
                </p>
                <Link href="/pricing" className="mt-3 inline-flex rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-white">
                  Upgrade
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </SectionCard>

      <SectionCard title="Diagnostics" description="Advanced routes, schema, and build checks." noPadding>
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">Developer diagnostics</p>
              <p className="text-[12px] text-muted-foreground">Routes, schema, build checks</p>
            </div>
          </div>
          <ChevronDown className={cn("size-4 transition", advancedOpen && "rotate-180")} />
        </button>
        {advancedOpen ? <div className="border-t border-border px-6 pb-5 pt-2">{advancedContent}</div> : null}
      </SectionCard>
    </div>
  );
}
