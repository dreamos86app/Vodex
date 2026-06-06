"use client";

import * as React from "react";
import { Loader2, Settings2 } from "lucide-react";
import { AppAuthSettingsPanel } from "@/components/settings/app-auth-settings-panel";
import { AuthProviderCard } from "@/components/settings/auth-provider-card";
import { CustomOAuthWizard, type OAuthWizardProvider } from "@/components/settings/custom-oauth-wizard";
import { AuthFallbackPanel } from "@/components/settings/auth-fallback-panel";
import { toast } from "@/lib/toast";

type AuthSettings = {
  email_password_enabled: boolean;
  google_enabled: boolean;
  github_enabled: boolean;
  apple_enabled: boolean;
  oauth_mode: "vodex_managed" | "custom";
  last_auth_error?: string | null;
  customOAuth?: {
    google: { configured: boolean; clientIdPreview: string | null };
    github: { configured: boolean; clientIdPreview: string | null };
    apple: { configured: boolean; gated: boolean; message: string };
  };
};

type Diagnostics = {
  ready: boolean;
  centralOAuthCallbackUrl: string | null;
  publishedAppCallbackUrl: string | null;
  publishedLoginUrl: string | null;
  lastAuthError: string | null;
  googleEnabled: boolean;
};

const OAUTH_PROVIDERS: Array<{
  id: OAuthWizardProvider;
  settingsKey?: keyof AuthSettings;
  label: string;
  customKey?: "google" | "github";
}> = [
  { id: "google", settingsKey: "google_enabled", label: "Google", customKey: "google" },
  { id: "github", settingsKey: "github_enabled", label: "GitHub", customKey: "github" },
  { id: "apple", settingsKey: "apple_enabled", label: "Apple" },
  { id: "microsoft", label: "Microsoft" },
  { id: "discord", label: "Discord" },
  { id: "facebook", label: "Facebook" },
  { id: "custom", label: "Custom OAuth" },
];

export function AppAuthCenter({
  projectId,
  planTier,
}: {
  projectId: string;
  planTier: "free" | "starter" | "pro" | "infinity";
}) {
  const [settings, setSettings] = React.useState<AuthSettings | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<Diagnostics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [wizardProvider, setWizardProvider] = React.useState<OAuthWizardProvider | null>(null);
  const [showLegacy, setShowLegacy] = React.useState(false);

  const canCustomOAuth = planTier === "pro" || planTier === "infinity";

  async function load() {
    const [settingsRes, diagRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/auth-settings`, { credentials: "include" }),
      fetch(`/api/projects/${projectId}/auth/diagnostics`, { credentials: "include" }),
    ]);
    if (settingsRes.ok) {
      const body = (await settingsRes.json()) as { settings?: AuthSettings };
      if (body.settings) setSettings(body.settings);
    }
    if (diagRes.ok) {
      const body = (await diagRes.json()) as { diagnostics?: Diagnostics };
      if (body.diagnostics) setDiagnostics(body.diagnostics);
    }
  }

  React.useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [projectId]);

  async function patchSettings(patch: Partial<AuthSettings>) {
    const next = { ...settings!, ...patch };
    const res = await fetch(`/api/projects/${projectId}/auth-settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await res.json()) as { error?: string; settings?: AuthSettings };
    if (!res.ok) throw new Error(body.error ?? "Could not update");
    if (body.settings) setSettings((s) => ({ ...s!, ...body.settings }));
    else setSettings(next);
    await load();
  }

  async function saveOAuth(provider: "google" | "github", creds: { client_id: string; client_secret: string }) {
    const res = await fetch(`/api/projects/${projectId}/auth-settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oauth_mode: "custom",
        google_enabled: provider === "google" ? true : settings?.google_enabled,
        github_enabled: provider === "github" ? true : settings?.github_enabled,
        custom_oauth: { [provider]: creds },
      }),
    });
    const body = (await res.json()) as { error?: string };
    if (!res.ok) throw new Error(body.error ?? "Save failed");
    await load();
  }

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const oauthFailed = Boolean(diagnostics?.lastAuthError || settings.last_auth_error);
  const redirectUri = diagnostics?.centralOAuthCallbackUrl ?? diagnostics?.publishedAppCallbackUrl;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-testid="app-auth-center">
      <div>
        <h2 className="text-[16px] font-semibold text-foreground">Authentication</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Provider cards, health checks, and custom OAuth — same quality bar as Integrations.
        </p>
      </div>

      <AuthFallbackPanel
        oauthFailed={oauthFailed}
        emailEnabled={settings.email_password_enabled}
        loginUrl={diagnostics?.publishedLoginUrl}
        onEnableEmail={() => void patchSettings({ email_password_enabled: true }).then(() => toast.success("Email login enabled"))}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {OAUTH_PROVIDERS.map((p) => {
          const enabled = p.settingsKey ? Boolean(settings[p.settingsKey]) : false;
          const configured =
            p.customKey && settings.customOAuth
              ? settings.customOAuth[p.customKey]?.configured
              : p.id === "custom"
                ? settings.oauth_mode === "custom"
                : undefined;
          const health: "ok" | "warn" | "off" = oauthFailed && enabled ? "warn" : enabled ? "ok" : "off";
          return (
            <AuthProviderCard
              key={p.id}
              name={p.label}
              enabled={enabled || settings.oauth_mode === "custom"}
              health={health}
              configured={configured}
              onToggle={
                p.settingsKey
                  ? (on) => void patchSettings({ [p.settingsKey!]: on } as Partial<AuthSettings>)
                  : undefined
              }
              onConfigure={() => {
                if (p.id === "microsoft" || p.id === "discord" || p.id === "facebook") {
                  toast.info(`${p.label} uses Vodex-managed OAuth — custom wizard available on request`);
                  return;
                }
                if (!canCustomOAuth && p.id !== "custom") {
                  toast.info("Custom OAuth setup requires Pro or higher");
                  return;
                }
                setWizardProvider(p.id);
              }}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowLegacy((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Settings2 className="size-3.5" />
        {showLegacy ? "Hide" : "Show"} advanced auth settings
      </button>

      {showLegacy ? (
        <AppAuthSettingsPanel projectId={projectId} planTier={planTier} />
      ) : null}

      {wizardProvider ? (
        <CustomOAuthWizard
          open
          provider={wizardProvider}
          onClose={() => setWizardProvider(null)}
          redirectUri={redirectUri ?? null}
          callbackUrl={diagnostics?.publishedAppCallbackUrl ?? null}
          configured={
            wizardProvider === "google"
              ? settings.customOAuth?.google.configured
              : wizardProvider === "github"
                ? settings.customOAuth?.github.configured
                : false
          }
          initialClientId={
            wizardProvider === "google"
              ? settings.customOAuth?.google.clientIdPreview ?? ""
              : wizardProvider === "github"
                ? settings.customOAuth?.github.clientIdPreview ?? ""
                : ""
          }
          onSave={async (creds) => {
            if (wizardProvider === "google" || wizardProvider === "github") {
              await saveOAuth(wizardProvider, creds);
            } else {
              await patchSettings({ oauth_mode: "custom" });
            }
            setWizardProvider(null);
          }}
          onHealthCheck={async () => {
            const r = await fetch(`/api/projects/${projectId}/auth/test-config`, {
              method: "POST",
              credentials: "include",
            });
            const body = (await r.json()) as { ready?: boolean; message?: string };
            return { ok: Boolean(body.ready), message: body.message };
          }}
        />
      ) : null}
    </div>
  );
}
