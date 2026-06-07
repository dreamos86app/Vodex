"use client";

import * as React from "react";
import {
  Loader2,
  Mail,
  Phone,
} from "lucide-react";
import { AuthProviderRow } from "@/components/settings/auth-provider-row";
import { CustomOAuthWizard, type OAuthWizardProvider } from "@/components/settings/custom-oauth-wizard";
import { AuthFallbackPanel } from "@/components/settings/auth-fallback-panel";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type AuthSettings = {
  email_password_enabled: boolean;
  google_enabled: boolean;
  github_enabled: boolean;
  apple_enabled: boolean;
  phone_enabled?: boolean;
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

function ProviderIcon({ label, className }: { label: string; className?: string }) {
  const initials = label.slice(0, 1).toUpperCase();
  const colors: Record<string, string> = {
    Google: "bg-white text-[#4285F4]",
    GitHub: "bg-[#24292f] text-white",
    Apple: "bg-black text-white",
    Microsoft: "bg-[#00A4EF] text-white",
    Discord: "bg-[#5865F2] text-white",
    Facebook: "bg-[#1877F2] text-white",
  };
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-md text-[11px] font-bold",
        colors[label] ?? "bg-accent/15 text-accent",
        className,
      )}
    >
      {initials}
    </span>
  );
}

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

  const canCustomOAuth = planTier !== "free";
  const starterPlus = planTier === "starter" || planTier === "pro" || planTier === "infinity";

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
    const res = await fetch(`/api/projects/${projectId}/auth-settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await res.json()) as { error?: string; settings?: AuthSettings };
    if (!res.ok) throw new Error(body.error ?? "Could not update");
    if (body.settings) setSettings((s) => ({ ...s!, ...body.settings }));
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
      <div className="flex justify-center py-12" data-testid="app-auth-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const oauthFailed = Boolean(diagnostics?.lastAuthError || settings.last_auth_error);
  const redirectUri = diagnostics?.centralOAuthCallbackUrl ?? diagnostics?.publishedAppCallbackUrl;

  const healthFor = (enabled: boolean): "ok" | "warn" | "off" =>
    oauthFailed && enabled ? "warn" : enabled ? "ok" : "off";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4" data-testid="app-auth-center">
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-foreground">Authentication</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Enable sign-in methods for your published app. Gmail and email login are recommended first.
        </p>
      </div>

      <AuthFallbackPanel
        oauthFailed={oauthFailed}
        emailEnabled={settings.email_password_enabled}
        loginUrl={diagnostics?.publishedLoginUrl}
        onEnableEmail={() =>
          void patchSettings({ email_password_enabled: true }).then(() => toast.success("Email login enabled"))
        }
      />

      <div className="space-y-2.5">
        <AuthProviderRow
          id="email"
          testId="auth-provider-row-email"
          icon={<Mail className="size-5 text-accent" />}
          title="Gmail / Email & Password"
          description="Email and password login with optional magic link. Enabled by default for most apps."
          enabled={settings.email_password_enabled}
          health={healthFor(settings.email_password_enabled)}
          statusBadge={settings.email_password_enabled ? "Primary" : undefined}
          onToggle={(on) => void patchSettings({ email_password_enabled: on })}
          onConfigure={() => toast.info("Configure SMTP and password rules in your app settings")}
          configureLabel="Email options"
          docsHref="https://vodex.dev/docs/auth/email"
        />

        <AuthProviderRow
          id="google"
          icon={<ProviderIcon label="Google" />}
          title="Google"
          description="Vodex-managed Google sign-in, or connect your own OAuth client below."
          enabled={settings.google_enabled}
          health={healthFor(settings.google_enabled)}
          onToggle={(on) => void patchSettings({ google_enabled: on })}
          onConfigure={() => setWizardProvider("google")}
          configureLabel={settings.customOAuth?.google.configured ? "Manage Google OAuth" : "Connect Google"}
          docsHref="https://vodex.dev/docs/auth/google"
        />

        <AuthProviderRow
          id="google-custom"
          nested
          icon={<ProviderIcon label="Google" className="opacity-80" />}
          title="Custom Google OAuth"
          description="Use your own Google Cloud OAuth client ID and secret."
          enabled={settings.customOAuth?.google.configured ?? false}
          health={settings.customOAuth?.google.configured ? "ok" : "off"}
          locked={!starterPlus}
          lockBadge={starterPlus ? undefined : "Starter+"}
          showToggle={false}
          onConfigure={() => (starterPlus ? setWizardProvider("google") : toast.info("Upgrade to Starter+ for custom OAuth"))}
          configureLabel="Configure client"
        />

        <AuthProviderRow
          id="phone"
          icon={<Phone className="size-5 text-accent" />}
          title="Phone number"
          description="SMS OTP sign-in. Visible to end users once SMS provider is configured."
          enabled={settings.phone_enabled ?? false}
          health={settings.phone_enabled ? "warn" : "off"}
          statusBadge="Visible"
          onToggle={(on) => void patchSettings({ phone_enabled: on } as Partial<AuthSettings>)}
          onConfigure={() => toast.info("Configure Twilio or Supabase phone auth in Integrations")}
          configureLabel="Setup SMS"
          docsHref="https://vodex.dev/docs/auth/phone"
        />

        {(
          [
            { id: "github" as const, label: "GitHub", key: "github_enabled" as const, customKey: "github" as const },
            { id: "apple" as const, label: "Apple", key: "apple_enabled" as const },
            { id: "microsoft" as const, label: "Microsoft" },
            { id: "discord" as const, label: "Discord" },
            { id: "facebook" as const, label: "Facebook" },
          ] as const
        ).map((p) => {
          const enabled = "key" in p && p.key ? Boolean(settings[p.key]) : false;
          const configured =
            "customKey" in p && p.customKey
              ? settings.customOAuth?.[p.customKey]?.configured
              : undefined;
          return (
            <AuthProviderRow
              key={p.id}
              id={p.id}
              icon={<ProviderIcon label={p.label} />}
              title={p.label}
              description={`Let users sign in with ${p.label}.`}
              enabled={enabled}
              health={healthFor(enabled)}
              statusBadge={configured ? "Configured" : undefined}
              onToggle={
                "key" in p && p.key
                  ? (on) => void patchSettings({ [p.key]: on } as Partial<AuthSettings>)
                  : undefined
              }
              showToggle={"key" in p && Boolean(p.key)}
              onConfigure={() => {
                if (p.id === "github") setWizardProvider("github");
                else if (p.id === "apple") setWizardProvider("apple");
                else toast.info(`${p.label} uses Vodex-managed OAuth`);
              }}
              docsHref={`https://vodex.dev/docs/auth/${p.id}`}
            />
          );
        })}

        <AuthProviderRow
          id="custom-oauth"
          icon={<ProviderIcon label="OAuth" />}
          title="Custom OAuth"
          description="Bring your own OAuth provider with client ID, secret, and redirect URI."
          enabled={settings.oauth_mode === "custom"}
          health={settings.oauth_mode === "custom" ? "ok" : "off"}
          locked={!canCustomOAuth}
          lockBadge={canCustomOAuth ? undefined : "Starter+"}
          showToggle={false}
          onConfigure={() =>
            canCustomOAuth ? setWizardProvider("custom") : toast.info("Upgrade to Starter+ for custom OAuth")
          }
          configureLabel="Open setup wizard"
          docsHref="https://vodex.dev/docs/auth/custom-oauth"
        />
      </div>

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
              ? (settings.customOAuth?.google.clientIdPreview ?? "")
              : wizardProvider === "github"
                ? (settings.customOAuth?.github.clientIdPreview ?? "")
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
