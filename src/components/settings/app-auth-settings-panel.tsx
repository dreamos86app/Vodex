"use client";

import * as React from "react";
import { Copy, Loader2, Shield, TestTube2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  usesDefaultSupabaseProjectHost,
  getSupabaseAuthCallbackUrl,
  supabaseAuthDomainStatusMessage,
} from "@/lib/supabase/auth-domain";
import { vodexSupabaseAuthDomainReady } from "@/lib/publish/publish-config";

type AuthSettings = {
  email_password_enabled: boolean;
  google_enabled: boolean;
  github_enabled: boolean;
  apple_enabled: boolean;
  microsoft_enabled?: boolean;
  facebook_enabled?: boolean;
  oauth_mode: "vodex_managed" | "custom";
};

const PROVIDERS: Array<{ key: keyof AuthSettings; label: string; planned?: boolean }> = [
  { key: "email_password_enabled", label: "Email & password" },
  { key: "google_enabled", label: "Google" },
  { key: "github_enabled", label: "GitHub" },
  { key: "apple_enabled", label: "Apple" },
  { key: "microsoft_enabled", label: "Microsoft", planned: true },
  { key: "facebook_enabled", label: "Facebook", planned: true },
];

export function AppAuthSettingsPanel({
  projectId,
  planTier,
  publicAppUrl,
}: {
  projectId: string;
  planTier: "free" | "starter" | "pro" | "infinity";
  publicAppUrl?: string | null;
}) {
  const [settings, setSettings] = React.useState<AuthSettings>({
    email_password_enabled: true,
    google_enabled: false,
    github_enabled: false,
    apple_enabled: false,
    microsoft_enabled: false,
    facebook_enabled: false,
    oauth_mode: "vodex_managed",
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const canCustomOAuth = planTier === "infinity";
  const callbackUrl = publicAppUrl
    ? `${publicAppUrl.replace(/\/$/, "")}/auth/callback`
    : getSupabaseAuthCallbackUrl();

  React.useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/projects/${projectId}/auth-settings`, { credentials: "include" });
        if (r.ok) {
          const body = (await r.json()) as { settings?: AuthSettings };
          if (body.settings) setSettings((s) => ({ ...s, ...body.settings }));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/auth-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (r.ok) toast.success("Auth settings saved");
      else toast.error("Could not save auth settings");
    } finally {
      setSaving(false);
    }
  }

  async function testProviders() {
    setTesting(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const enabled = PROVIDERS.filter((p) => settings[p.key] === true).map((p) => p.label);
      if (enabled.length === 0) toast.info("Enable at least one provider to test");
      else toast.success(`Auth config valid — ${enabled.join(", ")} enabled`);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <Loader2 className="size-4 animate-spin" />;

  return (
    <div className="space-y-5" data-testid="app-auth-settings-panel">
      <div
        className={cn(
          "rounded-xl px-3 py-2.5 text-[11px] ring-1",
          usesDefaultSupabaseProjectHost() && !vodexSupabaseAuthDomainReady()
            ? "bg-amber-500/10 text-amber-900 ring-amber-500/20"
            : "bg-emerald-500/10 text-emerald-900 ring-emerald-500/20",
        )}
      >
        {supabaseAuthDomainStatusMessage()}
      </div>

      <div>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Shield className="size-4 text-accent" />
          Sign-in methods
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Choose how visitors authenticate in your published app.
        </p>
        <div className="mt-3 space-y-1 rounded-xl bg-background/60 p-2 ring-1 ring-border/60">
          {PROVIDERS.map(({ key, label, planned }) => (
            <label
              key={key}
              className={cn(
                "flex items-center justify-between rounded-lg px-2 py-2 text-[12px]",
                planned && "opacity-50",
              )}
            >
              <span>
                {label}
                {planned ? <span className="ml-1 text-[10px] text-muted-foreground">(soon)</span> : null}
              </span>
              <input
                type="checkbox"
                disabled={planned}
                checked={Boolean(settings[key])}
                onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-surface px-3 py-3 ring-1 ring-border">
        <p className="text-[12px] font-semibold text-foreground">OAuth mode</p>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px]">
          <input
            type="radio"
            className="mt-0.5"
            checked={settings.oauth_mode === "vodex_managed"}
            onChange={() => setSettings((s) => ({ ...s, oauth_mode: "vodex_managed" }))}
          />
          <span>
            <span className="font-medium">Use Vodex-managed OAuth</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Recommended — we handle provider setup and branding.
            </span>
          </span>
        </label>
        <label
          className={cn(
            "mt-2 flex cursor-pointer items-start gap-2 text-[12px]",
            !canCustomOAuth && "opacity-50",
          )}
        >
          <input
            type="radio"
            className="mt-0.5"
            disabled={!canCustomOAuth}
            checked={settings.oauth_mode === "custom"}
            onChange={() => setSettings((s) => ({ ...s, oauth_mode: "custom" }))}
          />
          <span>
            <span className="font-medium">Custom OAuth credentials</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Infinity+ — bring your own Google/GitHub/Apple apps.
            </span>
          </span>
        </label>
      </div>

      {callbackUrl ? (
        <div className="rounded-xl bg-muted/30 px-3 py-3 ring-1 ring-border/60">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Callback URL
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Add this to your OAuth provider console.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-background px-2 py-1.5 text-[10px] ring-1 ring-border">
              {callbackUrl}
            </code>
            <button
              type="button"
              className="rounded-lg p-2 ring-1 ring-border"
              onClick={() => void navigator.clipboard.writeText(callbackUrl).then(() => toast.success("Copied"))}
            >
              <Copy className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save auth settings"}
        </button>
        <button
          type="button"
          disabled={testing}
          onClick={() => void testProviders()}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-medium ring-1 ring-border"
        >
          <TestTube2 className="size-3.5" />
          {testing ? "Testing…" : "Test providers"}
        </button>
      </div>
    </div>
  );
}
