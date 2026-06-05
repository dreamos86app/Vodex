"use client";

import * as React from "react";
import { BarChart3, Shield, Zap } from "lucide-react";
import { CustomDomainsPanel } from "@/components/publish/custom-domains-panel";
import { AppAuthSettingsPanel } from "@/components/settings/app-auth-settings-panel";
import { getEntitlements } from "@/lib/billing/plan-entitlements";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background/80 px-3 py-2 ring-1 ring-border/60">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function DashboardUsersSection({ publicUrl }: { publicUrl?: string | null }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        User signups from your published app appear here. Share your link to get started.
      </p>
      {publicUrl ? (
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-accent">
          Open live app →
        </a>
      ) : null}
      <Row label="Total users" value="0" />
      <Row label="Active this week" value="0" />
    </div>
  );
}

export function DashboardAnalyticsSection({ publicUrl }: { publicUrl?: string | null }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-foreground">
        <BarChart3 className="size-4 text-accent" /> Live traffic
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Row label="Page views (7d)" value="—" />
        <Row label="Unique visitors" value="—" />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Analytics populate after your app receives traffic{publicUrl ? ` at ${publicUrl.replace(/^https?:\/\//, "")}` : ""}.
      </p>
    </div>
  );
}

export function DashboardMarketingSection({ publicUrl, appName }: { publicUrl?: string | null; appName: string }) {
  const share = publicUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${appName}`)}&url=${encodeURIComponent(publicUrl)}`
    : null;
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">Share your live app and track growth.</p>
      {share ? (
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white"
        >
          Share on X
        </a>
      ) : null}
      <Row label="Share link clicks" value="0" />
    </div>
  );
}

export function DashboardLogsSection() {
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">Recent activity from your live app.</p>
      <div className="rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-800 ring-1 ring-emerald-500/20">
        App published — ready to receive traffic
      </div>
    </div>
  );
}

export function DashboardApiSection({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted-foreground">
        API keys for your generated app backend. Keys are stored encrypted and never shown again after creation.
      </p>
      <a
        href={`/apps/${projectId}/builder`}
        className="inline-flex rounded-xl px-4 py-2 text-[12px] font-medium ring-1 ring-border"
      >
        Open API docs in builder
      </a>
    </div>
  );
}

export function DashboardAutomationsSection() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold">
        <Zap className="size-4 text-amber-500" /> Automations
      </div>
      <p className="text-[12px] text-muted-foreground">
        Trigger emails, webhooks, and workflows when users sign up or submit forms.
      </p>
      <Row label="Active automations" value="0" />
    </div>
  );
}

export function DashboardDataSection() {
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">Collections and records created by your app users.</p>
      <Row label="Collections" value="0" />
      <Row label="Records" value="0" />
    </div>
  );
}

export function DashboardDomainsSection({
  projectId,
  planId,
  publishedSubdomain,
}: {
  projectId: string;
  planId: string;
  publishedSubdomain?: string | null;
}) {
  return (
    <CustomDomainsPanel
      projectId={projectId}
      canUseCustomDomain={getEntitlements(planId).canUseCustomDomain}
      publishedSubdomain={publishedSubdomain}
    />
  );
}

export function DashboardSecuritySection({
  projectId,
  planId,
  publicAppUrl,
}: {
  projectId: string;
  planId: string;
  publicAppUrl?: string | null;
}) {
  return (
    <div className="space-y-4">
      <AppAuthSettingsPanel
        projectId={projectId}
        planTier={getEntitlements(planId).tier}
        publicAppUrl={publicAppUrl}
      />
      <div className="rounded-xl bg-surface px-3 py-3 ring-1 ring-border">
        <div className="flex items-center gap-2 text-[12px] font-semibold">
          <Shield className="size-4 text-accent" /> Security
        </div>
        <div className="mt-2 space-y-2">
          <Row label="HTTPS" value="Enforced" />
          <Row label="Public app" value="Live" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSettingsWatermark({
  planId,
  disabled,
  onToggle,
}: {
  planId: string;
  disabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  const canDisable = getEntitlements(planId).tier !== "free";
  return (
    <div className="rounded-xl bg-surface px-3 py-3 ring-1 ring-border">
      <p className="text-[12px] font-semibold text-foreground">Published app watermark</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Free plans always show &quot;Made with Vodex&quot; on published apps. Starter+ can hide it.
      </p>
      <label className="mt-3 flex items-center gap-2 text-[12px]">
        <input
          type="checkbox"
          disabled={!canDisable}
          checked={canDisable ? disabled : false}
          onChange={(e) => onToggle(e.target.checked)}
        />
        Hide watermark on published app
      </label>
      {!canDisable ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          <a href="/billing" className="text-accent">
            Upgrade to Starter
          </a>{" "}
          to remove the watermark.
        </p>
      ) : null}
    </div>
  );
}
