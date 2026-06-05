"use client";

import * as React from "react";
import { Loader2, Shield } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { usesDefaultSupabaseProjectHost, getSupabaseAuthCallbackUrl } from "@/lib/supabase/auth-domain";
import { vodexSupabaseAuthDomainReady } from "@/lib/publish/publish-config";

type AuthSettings = {
  email_password_enabled: boolean;
  google_enabled: boolean;
  github_enabled: boolean;
  apple_enabled: boolean;
  oauth_mode: "vodex_managed" | "custom";
};

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
    oauth_mode: "vodex_managed",
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

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
          if (body.settings) setSettings(body.settings);
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

  if (loading) return <Loader2 className="size-4 animate-spin" />;

  return (
    <div className="space-y-4" data-testid="app-auth-settings-panel">
      {usesDefaultSupabaseProjectHost() && !vodexSupabaseAuthDomainReady() && (
        <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 ring-1 ring-amber-500/20">
          Vodex Auth domain not configured yet — using Supabase project domain. Upgrade Supabase plan +
          Custom Domain add-on, then set <code>NEXT_PUBLIC_SUPABASE_URL</code> to your Vodex auth domain.
        </div>
      )}

      <div className="flex items-center gap-2 text-[12px]">
        <Shield className="size-4 text-accent" />
        <span className="font-semibold">Authentication providers</span>
      </div>

      {(
        [
          ["email_password_enabled", "Email & password"],
          ["google_enabled", "Google"],
          ["github_enabled", "GitHub"],
          ["apple_enabled", "Apple"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px]">
          <span>{label}</span>
          <input
            type="checkbox"
            checked={settings[key]}
            onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
          />
        </label>
      ))}

      <div className="rounded-xl bg-surface px-3 py-2 text-[11px] ring-1 ring-border">
        <p className="font-semibold text-foreground">OAuth mode</p>
        <label className="mt-2 flex items-center gap-2">
          <input
            type="radio"
            checked={settings.oauth_mode === "vodex_managed"}
            onChange={() => setSettings((s) => ({ ...s, oauth_mode: "vodex_managed" }))}
          />
          Use Vodex-managed OAuth
        </label>
        <label className={cn("mt-1 flex items-center gap-2", !canCustomOAuth && "opacity-50")}>
          <input
            type="radio"
            disabled={!canCustomOAuth}
            checked={settings.oauth_mode === "custom"}
            onChange={() => setSettings((s) => ({ ...s, oauth_mode: "custom" }))}
          />
          Custom OAuth (Infinity+)
        </label>
      </div>

      {callbackUrl && (
        <div className="rounded-xl bg-muted/40 px-3 py-2 text-[11px]">
          <p className="font-medium">Callback URL (copy to provider)</p>
          <code className="mt-1 block break-all">{callbackUrl}</code>
        </div>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="rounded-xl bg-accent px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save auth settings"}
      </button>
    </div>
  );
}
