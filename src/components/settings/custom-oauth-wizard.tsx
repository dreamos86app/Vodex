"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ExternalLink, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export type OAuthWizardProvider =
  | "google"
  | "github"
  | "apple"
  | "microsoft"
  | "discord"
  | "facebook"
  | "custom";

const PROVIDER_DOCS: Record<
  OAuthWizardProvider,
  { title: string; docsUrl: string; steps: string[] }
> = {
  google: {
    title: "Google OAuth",
    docsUrl: "https://developers.google.com/identity/protocols/oauth2",
    steps: [
      "Open Google Cloud Console → APIs & Services → Credentials",
      "Create an OAuth 2.0 Client ID (Web application)",
      "Add the Vodex redirect URI below to Authorized redirect URIs",
      "Copy Client ID and Client Secret into the fields below",
      "Save, then run Health check",
    ],
  },
  apple: {
    title: "Apple Sign In",
    docsUrl: "https://developer.apple.com/documentation/sign_in_with_apple",
    steps: [
      "Apple Developer → Certificates, Identifiers & Profiles → Services IDs",
      "Configure Sign in with Apple and add return URLs",
      "Create a Services ID key and note Client ID",
      "For hosted auth, mirror credentials in Supabase",
    ],
  },
  github: {
    title: "GitHub OAuth",
    docsUrl: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps",
    steps: [
      "GitHub → Settings → Developer settings → OAuth Apps → New OAuth App",
      "Set Homepage URL to your published app URL",
      "Set Authorization callback URL to the redirect URI below",
      "Copy Client ID and generate a Client Secret",
      "Save credentials here and run Health check",
    ],
  },
  microsoft: {
    title: "Microsoft OAuth",
    docsUrl: "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app",
    steps: [
      "Azure Portal → App registrations → New registration",
      "Add a Web redirect URI matching the callback below",
      "Create a client secret under Certificates & secrets",
      "Copy Application (client) ID and secret",
    ],
  },
  discord: {
    title: "Discord OAuth",
    docsUrl: "https://discord.com/developers/docs/topics/oauth2",
    steps: [
      "Discord Developer Portal → Applications → OAuth2",
      "Add redirect URI below",
      "Copy Client ID and Client Secret",
    ],
  },
  facebook: {
    title: "Facebook Login",
    docsUrl: "https://developers.facebook.com/docs/facebook-login",
    steps: [
      "Meta Developer → App → Facebook Login → Settings",
      "Add Valid OAuth Redirect URI",
      "Copy App ID and App Secret",
    ],
  },
  custom: {
    title: "Custom OAuth",
    docsUrl: "https://supabase.com/docs/guides/auth/social-login",
    steps: [
      "Register your OAuth app with your identity provider",
      "Add the Vodex callback URL to allowed redirect URIs",
      "Enter Client ID and Client Secret",
      "Mirror the same credentials in Supabase Auth if using hosted auth",
    ],
  },
};

type Props = {
  open: boolean;
  onClose: () => void;
  provider: OAuthWizardProvider;
  redirectUri: string | null;
  callbackUrl: string | null;
  initialClientId?: string;
  configured?: boolean;
  onSave: (input: { client_id: string; client_secret: string }) => Promise<void>;
  onHealthCheck: () => Promise<{ ok: boolean; message?: string }>;
};

export function CustomOAuthWizard({
  open,
  onClose,
  provider,
  redirectUri,
  callbackUrl,
  initialClientId = "",
  configured,
  onSave,
  onHealthCheck,
}: Props) {
  const [clientId, setClientId] = React.useState(initialClientId);
  const [clientSecret, setClientSecret] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [health, setHealth] = React.useState<"idle" | "ok" | "fail">("idle");
  const meta = PROVIDER_DOCS[provider];

  React.useEffect(() => {
    if (open) {
      setClientId(initialClientId);
      setClientSecret("");
      setHealth("idle");
    }
  }, [open, initialClientId]);

  function copy(text: string) {
    void navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[10060] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
            aria-label="Close"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl ring-1 ring-border sm:rounded-2xl"
            data-testid="custom-oauth-wizard"
          >
            <div className="flex items-start justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-[15px] font-semibold text-foreground">{meta.title} setup</p>
                <p className="text-[12px] text-muted-foreground">Configure credentials for your published app</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <ol className="space-y-2 text-[12px] text-muted-foreground">
                {meta.steps.map((step, i) => (
                  <li key={step} className="flex gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>

              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
              >
                Provider documentation
                <ExternalLink className="size-3" />
              </a>

              {redirectUri ? (
                <UrlCopyBlock label="Redirect URI (add to provider)" url={redirectUri} onCopy={copy} />
              ) : null}
              {callbackUrl && callbackUrl !== redirectUri ? (
                <UrlCopyBlock label="Callback URL" url={callbackUrl} onCopy={copy} />
              ) : null}

              <div className="space-y-2">
                <label className="text-[11px] font-medium text-muted-foreground">Client ID</label>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px]"
                  placeholder="Client ID"
                  autoComplete="off"
                />
                <label className="text-[11px] font-medium text-muted-foreground">Client Secret</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-[13px]"
                  placeholder={configured ? "Leave blank to keep existing secret" : "Client Secret"}
                  autoComplete="new-password"
                />
              </div>

              {health === "ok" ? (
                <p className="flex items-center gap-1.5 text-[12px] text-emerald-700">
                  <CheckCircle2 className="size-4" /> Health check passed
                </p>
              ) : health === "fail" ? (
                <p className="flex items-center gap-1.5 text-[12px] text-destructive">
                  <AlertTriangle className="size-4" /> Health check failed — verify redirect URI and credentials
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                disabled={saving || !clientId.trim()}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onSave({ client_id: clientId.trim(), client_secret: clientSecret });
                    toast.success("OAuth credentials saved");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Save failed");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="rounded-xl bg-accent px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
              </button>
              <button
                type="button"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  try {
                    const r = await onHealthCheck();
                    setHealth(r.ok ? "ok" : "fail");
                    if (r.ok) toast.success(r.message ?? "Configuration looks good");
                    else toast.error(r.message ?? "Health check failed");
                  } finally {
                    setTesting(false);
                  }
                }}
                className="rounded-xl px-4 py-2.5 text-[12px] font-semibold ring-1 ring-border"
              >
                {testing ? "Testing…" : "Health check"}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

function UrlCopyBlock({
  label,
  url,
  onCopy,
}: {
  label: string;
  url: string;
  onCopy: (t: string) => void;
}) {
  return (
    <div className="rounded-xl bg-muted/30 p-3 ring-1 ring-border/60">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg bg-background px-2 py-1.5 text-[10px] ring-1 ring-border">
          {url}
        </code>
        <button type="button" onClick={() => onCopy(url)} className="shrink-0 rounded-lg p-2 ring-1 ring-border">
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
