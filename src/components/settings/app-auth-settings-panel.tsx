"use client";

import * as React from "react";
import { Copy, ExternalLink, Loader2, Shield, TestTube2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { supabaseAuthDomainStatusMessage } from "@/lib/supabase/auth-domain";
import { vodexSupabaseAuthDomainReady } from "@/lib/publish/publish-config";
import { ContextualHelp } from "@/components/help/contextual-help";
import { usesDefaultSupabaseProjectHost } from "@/lib/supabase/auth-domain";

type AuthSettings = {
  email_password_enabled: boolean;
  google_enabled: boolean;
  github_enabled: boolean;
  apple_enabled: boolean;
  oauth_mode: "vodex_managed" | "custom";
  last_auth_error?: string | null;
  last_auth_error_at?: string | null;
  customOAuth?: {
    google: { configured: boolean; clientIdPreview: string | null };
    github: { configured: boolean; clientIdPreview: string | null };
    apple: { configured: boolean; gated: boolean; message: string };
  };
};

type Diagnostics = {
  ready: boolean;
  oauthMode: "vodex_managed" | "custom";
  supabaseUrl: string | null;
  supabaseAnonKeyDetected: boolean;
  serviceRoleDetected: boolean;
  authDomainReady: boolean;
  publishedSlug: string | null;
  publishedAppCallbackUrl: string | null;
  centralOAuthCallbackUrl: string | null;
  centralOAuthRecommended: boolean;
  publishedLoginUrl: string | null;
  supabaseAuthCallbackUrl: string | null;
  googleEnabled: boolean;
  lastAuthError: string | null;
  checks: Array<{ id: string; label: string; status: "ok" | "warn" | "error"; detail: string }>;
  redirectUrlHints: string[];
};

const PROVIDERS: Array<{ key: keyof AuthSettings; label: string; planned?: boolean }> = [
  { key: "email_password_enabled", label: "Email & password" },
  { key: "google_enabled", label: "Google" },
  { key: "github_enabled", label: "GitHub" },
  { key: "apple_enabled", label: "Apple" },
];

function StatusIcon({ status }: { status: "ok" | "warn" | "error" }) {
  if (status === "ok") return <CheckCircle2 className="size-3.5 text-emerald-600" />;
  if (status === "error") return <AlertTriangle className="size-3.5 text-red-600" />;
  return <AlertTriangle className="size-3.5 text-amber-600" />;
}

export function AppAuthSettingsPanel({
  projectId,
  planTier,
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
  const [customGoogle, setCustomGoogle] = React.useState({ client_id: "", client_secret: "" });
  const [customGithub, setCustomGithub] = React.useState({ client_id: "", client_secret: "" });
  const [diagnostics, setDiagnostics] = React.useState<Diagnostics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const canCustomOAuth = planTier === "pro" || planTier === "infinity";

  async function loadDiagnostics() {
    const r = await fetch(`/api/projects/${projectId}/auth/diagnostics`, { credentials: "include" });
    if (r.ok) {
      const body = (await r.json()) as { diagnostics?: Diagnostics };
      if (body.diagnostics) setDiagnostics(body.diagnostics);
    }
  }

  React.useEffect(() => {
    void (async () => {
      try {
        const [settingsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/auth-settings`, { credentials: "include" }),
          loadDiagnostics(),
        ]);
        if (settingsRes.ok) {
          const body = (await settingsRes.json()) as { settings?: AuthSettings };
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
      const payload: Record<string, unknown> = { ...settings };
      if (settings.oauth_mode === "custom") {
        payload.custom_oauth = {
          google: customGoogle.client_id || customGoogle.client_secret ? customGoogle : undefined,
          github: customGithub.client_id || customGithub.client_secret ? customGithub : undefined,
        };
      }
      const r = await fetch(`/api/projects/${projectId}/auth-settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await r.json()) as { error?: string; settings?: AuthSettings };
      if (r.ok) {
        if (body.settings) setSettings((s) => ({ ...s, ...body.settings }));
        setCustomGoogle({ client_id: "", client_secret: "" });
        setCustomGithub({ client_id: "", client_secret: "" });
        await loadDiagnostics();
        toast.success("Auth settings saved");
      } else {
        toast.error(body.error ?? "Could not save auth settings");
      }
    } finally {
      setSaving(false);
    }
  }

  async function testConfig() {
    setTesting(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/auth/test-config`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await r.json()) as { ready?: boolean; message?: string };
      await loadDiagnostics();
      if (body.ready) toast.success(body.message ?? "Auth config ready");
      else toast.error(body.message ?? "Auth config incomplete");
    } finally {
      setTesting(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  if (loading) return <Loader2 className="size-4 animate-spin" />;

  const loginUrl = diagnostics?.publishedLoginUrl;

  return (
    <div className="space-y-5" data-testid="app-auth-settings-panel">
      <ContextualHelp guideHref="/help/authentication/overview" />
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

      <div className="rounded-xl bg-surface px-3 py-3 ring-1 ring-border">
        <p className="text-[12px] font-semibold text-foreground">Auth diagnostics</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Configuration status for published sign-in. Secrets are never shown.
        </p>
        {diagnostics ? (
          <div className="mt-3 space-y-2">
            <div className="grid gap-1.5 text-[11px]">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Supabase URL</span>
                <span className="truncate font-mono">{diagnostics.supabaseUrl ?? "Missing"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Anon key</span>
                <span>{diagnostics.supabaseAnonKeyDetected ? "Detected" : "Missing"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Auth domain</span>
                <span>{diagnostics.authDomainReady ? "Ready" : "Not active"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">OAuth mode</span>
                <span>{diagnostics.oauthMode === "custom" ? "Custom" : "Vodex-managed"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Google enabled</span>
                <span>{diagnostics.googleEnabled ? "Yes" : "No"}</span>
              </div>
            </div>
            {diagnostics.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-2 rounded-lg bg-background/60 px-2 py-1.5 text-[11px]">
                <StatusIcon status={c.status} />
                <div>
                  <span className="font-medium">{c.label}</span>
                  <p className="text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            ))}
            {(diagnostics.lastAuthError || settings.last_auth_error) ? (
              <div className="rounded-lg bg-red-500/10 px-2 py-1.5 text-[11px] text-red-800 ring-1 ring-red-500/20">
                <span className="font-semibold">Last auth error: </span>
                {diagnostics.lastAuthError ?? settings.last_auth_error}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">Diagnostics unavailable.</p>
        )}
      </div>

      {diagnostics?.centralOAuthCallbackUrl || diagnostics?.publishedAppCallbackUrl || diagnostics?.supabaseAuthCallbackUrl ? (
        <div className="rounded-xl bg-muted/30 px-3 py-3 ring-1 ring-border/60 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Required redirect URLs
          </p>
          {diagnostics.centralOAuthCallbackUrl ? (
            <UrlRow
              label={diagnostics.centralOAuthRecommended ? "Central callback (recommended)" : "Central callback"}
              url={diagnostics.centralOAuthCallbackUrl}
              onCopy={copyText}
            />
          ) : null}
          {diagnostics.publishedAppCallbackUrl ? (
            <UrlRow label="Legacy app callback (fallback)" url={diagnostics.publishedAppCallbackUrl} onCopy={copyText} />
          ) : null}
          {diagnostics.supabaseAuthCallbackUrl ? (
            <UrlRow label="Supabase callback" url={diagnostics.supabaseAuthCallbackUrl} onCopy={copyText} />
          ) : null}
          {diagnostics.publishedLoginUrl ? (
            <UrlRow label="Published login" url={diagnostics.publishedLoginUrl} onCopy={copyText} />
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <Shield className="size-4 text-accent" />
          Sign-in methods
        </div>
        <div className="mt-3 space-y-1 rounded-xl bg-background/60 p-2 ring-1 ring-border/60">
          {PROVIDERS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between rounded-lg px-2 py-2 text-[12px]">
              <span>{label}</span>
              <input
                type="checkbox"
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
            <span className="font-medium">Vodex-managed OAuth</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Recommended — platform handles provider setup.
            </span>
          </span>
        </label>
        <label
          className={cn("mt-2 flex cursor-pointer items-start gap-2 text-[12px]", !canCustomOAuth && "opacity-50")}
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
              Pro+ — your Google/GitHub OAuth apps. Also mirror credentials in Supabase Auth.
            </span>
          </span>
        </label>
      </div>

      {settings.oauth_mode === "custom" && canCustomOAuth ? (
        <div className="space-y-3 rounded-xl bg-muted/20 px-3 py-3 ring-1 ring-border/60">
          <p className="text-[12px] font-semibold">Custom OAuth credentials</p>
          <OAuthCredentialForm
            provider="Google"
            configured={settings.customOAuth?.google.configured}
            preview={settings.customOAuth?.google.clientIdPreview}
            values={customGoogle}
            onChange={setCustomGoogle}
          />
          <OAuthCredentialForm
            provider="GitHub"
            configured={settings.customOAuth?.github.configured}
            preview={settings.customOAuth?.github.clientIdPreview}
            values={customGithub}
            onChange={setCustomGithub}
          />
          <p className="text-[10px] text-muted-foreground">
            {settings.customOAuth?.apple.message ?? "Apple custom OAuth is not available yet."}
          </p>
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
          onClick={() => void testConfig()}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-medium ring-1 ring-border"
        >
          <TestTube2 className="size-3.5" />
          {testing ? "Testing…" : "Test auth config"}
        </button>
        {loginUrl ? (
          <a
            href={loginUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-medium ring-1 ring-border"
          >
            <ExternalLink className="size-3.5" />
            Open login page
          </a>
        ) : null}
      </div>
    </div>
  );
}

function UrlRow({
  label,
  url,
  onCopy,
}: {
  label: string;
  url: string;
  onCopy: (t: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 break-all rounded-lg bg-background px-2 py-1.5 text-[10px] ring-1 ring-border">
          {url}
        </code>
        <button type="button" className="rounded-lg p-2 ring-1 ring-border" onClick={() => onCopy(url)}>
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function OAuthCredentialForm({
  provider,
  configured,
  preview,
  values,
  onChange,
}: {
  provider: string;
  configured?: boolean;
  preview?: string | null;
  values: { client_id: string; client_secret: string };
  onChange: (v: { client_id: string; client_secret: string }) => void;
}) {
  return (
    <div className="rounded-lg bg-background/80 p-2 ring-1 ring-border/50">
      <p className="text-[11px] font-medium">
        {provider}
        {configured ? <span className="ml-1 text-emerald-600">(configured {preview ?? ""})</span> : null}
      </p>
      <input
        type="text"
        placeholder="Client ID"
        value={values.client_id}
        onChange={(e) => onChange({ ...values, client_id: e.target.value })}
        className="mt-2 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]"
      />
      <input
        type="password"
        placeholder={configured ? "Client secret (leave blank to keep)" : "Client secret"}
        value={values.client_secret}
        onChange={(e) => onChange({ ...values, client_secret: e.target.value })}
        className="mt-1.5 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[11px]"
      />
    </div>
  );
}
