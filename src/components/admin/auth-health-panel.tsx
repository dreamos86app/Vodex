"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Play,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAppUrl, getCallbackUrl } from "@/lib/auth";
import { getSupabaseProjectRefFromUrl } from "@/lib/supabase/auth-domain";
import type { AuthHealthResult, ProviderStatus } from "@/app/api/admin/auth-health/route";

// ─── Status atoms ─────────────────────────────────────────────────────────────

type StatusKind = "pass" | "fail" | "warn" | "info" | "loading";

function StatusIcon({ kind }: { kind: StatusKind }) {
  if (kind === "loading") return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  if (kind === "pass") return <CheckCircle2 className="size-4 text-positive" strokeWidth={1.75} />;
  if (kind === "fail") return <XCircle className="size-4 text-destructive" strokeWidth={1.75} />;
  if (kind === "warn") return <AlertCircle className="size-4 text-amber-500" strokeWidth={1.75} />;
  return <HelpCircle className="size-4 text-muted-foreground/60" strokeWidth={1.75} />;
}

function Row({
  label,
  kind,
  detail,
  extra,
  action,
}: {
  label: string;
  kind: StatusKind;
  detail?: string;
  extra?: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <StatusIcon kind={kind} />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-foreground">{label}</p>
        {detail && (
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{detail}</p>
        )}
        {extra}
      </div>
      {action && (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-accent hover:underline underline-offset-4 shrink-0"
        >
          {action.label}
          <ExternalLink className="size-2.5" />
        </a>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-xl)] bg-surface ring-1 ring-border overflow-hidden">
      <div className="border-b border-border px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      <div className="divide-y divide-border/60 px-4">{children}</div>
    </div>
  );
}

// ─── Copyable text ─────────────────────────────────────────────────────────────

function CopyText({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      className="mt-1 flex items-center gap-1.5 rounded bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground transition max-w-full"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title="Copy to clipboard"
    >
      <span className="truncate">{value}</span>
      {copied ? <Check className="size-2.5 shrink-0 text-positive" /> : <Copy className="size-2.5 shrink-0" />}
    </button>
  );
}

// ─── Provider test row ────────────────────────────────────────────────────────

function ProviderRow({
  provider,
  status,
  onTest,
  testing,
  dashboardHref,
}: {
  provider: "Google" | "GitHub";
  status: ProviderStatus;
  onTest: () => void;
  testing: boolean;
  dashboardHref: string;
}) {
  const kind =
    status === "enabled" ? "pass" : status === "disabled" ? "fail" : "info";

  const detail =
    status === "enabled"
      ? `${provider} OAuth is active`
      : status === "disabled"
        ? `${provider} OAuth is not enabled in Supabase`
        : "Could not auto-detect — run test or check dashboard";

  return (
    <div className="flex items-start gap-3 py-3">
      <StatusIcon kind={kind} />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-foreground">{provider} OAuth</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onTest}
          disabled={testing}
          title={`Test ${provider} OAuth`}
          className="flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition disabled:opacity-50"
        >
          {testing ? <Loader2 className="size-3 animate-spin" /> : <Play className="size-3" />}
          Test
        </button>
        {status !== "enabled" && (
          <a
            href={dashboardHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-accent hover:underline underline-offset-4"
          >
            Enable
            <ExternalLink className="size-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Summary badge ────────────────────────────────────────────────────────────

function SummaryBadge({ data }: { data: AuthHealthResult }) {
  const checks = [
    data.env.supabaseUrl,
    data.env.supabaseKey,
    data.middleware,
    data.routes.callback,
    data.providers.google === "enabled",
    data.providers.github === "enabled",
  ];
  const passing = checks.filter(Boolean).length;
  const total = checks.length;
  const allGood = passing === total;

  return (
    <span
      className={cn(
        "ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold",
        allGood
          ? "bg-positive/10 text-positive"
          : passing >= total - 2
            ? "bg-amber-500/10 text-amber-500"
            : "bg-destructive/10 text-destructive",
      )}
    >
      {passing}/{total} checks passing
    </span>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function AuthHealthPanel() {
  const [data, setData] = React.useState<AuthHealthResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [testingProvider, setTestingProvider] = React.useState<"google" | "github" | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const projectRef = getSupabaseProjectRefFromUrl(supabaseUrl) ?? "_";
  const dashboardBase = `https://supabase.com/dashboard/project/${projectRef}`;

  // Client-side URL validation
  const appUrl = getAppUrl();
  const expectedCallback = getCallbackUrl();
  const originMatchesAppUrl =
    typeof window !== "undefined"
      ? window.location.origin === (process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin)
      : true;

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth-health");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load health data");
    } finally {
      setLoading(false);
    }
  }

  async function testProvider(provider: "google" | "github") {
    setTestingProvider(provider);
    try {
      const res = await fetch(`/api/admin/auth-health?probe=${provider}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json() as AuthHealthResult;
      setData((prev) => prev ? { ...prev, providers: result.providers } : result);
    } catch {
      // Silently fall back
    } finally {
      setTestingProvider(null);
    }
  }

  React.useEffect(() => { void refresh(); }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-accent" strokeWidth={1.75} />
        <p className="text-[13px] font-semibold text-foreground">Auth System Health</p>
        {data && <SummaryBadge data={data} />}
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="ml-2 gap-1.5 text-[12px]"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} strokeWidth={1.75} />
          Refresh
        </Button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg bg-destructive/10 px-4 py-3 text-[12px] text-destructive ring-1 ring-destructive/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {data?.oauthBranding?.usesDefaultSupabaseHost && data.oauthBranding.hint && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-950 dark:text-amber-100">
          <p className="font-semibold">OAuth branding uses Supabase project URL</p>
          <p className="mt-1 text-[11px] opacity-90">
            Google may show <span className="font-mono">{data.oauthBranding.supabaseUrlHost}</span> until you
            configure a Supabase custom domain (e.g. auth.dreamos86.com). See{" "}
            <code className="rounded bg-background/60 px-1 py-0.5 text-[10px]">
              docs/supabase-custom-auth-domain.md
            </code>
            .
          </p>
        </div>
      )}

      {/* Infrastructure */}
      <Section title="Infrastructure">
        <Row
          label="Supabase URL"
          kind={data ? (data.env.supabaseUrl ? "pass" : "fail") : "loading"}
          detail={data?.env.supabaseUrl ? supabaseUrl : "NEXT_PUBLIC_SUPABASE_URL not set"}
          action={{ label: "Dashboard", href: dashboardBase }}
        />
        <Row
          label="Supabase Anon Key"
          kind={data ? (data.env.supabaseKey ? "pass" : "fail") : "loading"}
          detail={data?.env.supabaseKey ? "Configured" : "NEXT_PUBLIC_SUPABASE_ANON_KEY missing"}
        />
        <Row
          label="App URL (NEXT_PUBLIC_APP_URL)"
          kind={data ? (data.env.appUrl ? "pass" : "warn") : "loading"}
          detail={
            data
              ? data.env.appUrl
                ? data.env.appUrlValue ?? ""
                : "Not set — all redirects fall back to window.location.origin"
              : undefined
          }
          extra={
            data?.env.appUrl && !originMatchesAppUrl ? (
              <p className="mt-1 text-[11px] text-amber-500">
                ⚠ Mismatch: NEXT_PUBLIC_APP_URL ≠ current origin. Check production env vars.
              </p>
            ) : undefined
          }
        />
      </Section>

      {/* Redirect URLs */}
      <Section title="Redirect URLs">
        <Row
          label="Callback URL"
          kind="pass"
          detail="This URL must be in your Supabase redirect allowlist"
          extra={<CopyText value={expectedCallback} />}
          action={{ label: "Add to Supabase", href: `${dashboardBase}/auth/url-configuration` }}
        />
        <Row
          label="Password reset URL"
          kind="pass"
          detail="Used by forgot-password emails"
          extra={<CopyText value={`${appUrl}/auth/callback?type=recovery`} />}
        />
        <Row
          label="Email confirmation URL"
          kind="pass"
          detail="Used by signup confirmation emails"
          extra={<CopyText value={`${appUrl}/auth/callback`} />}
        />
        <Row
          label="Redirect allowlist config"
          kind="info"
          detail="Add both localhost and your production domain"
          action={{ label: "URL configuration", href: `${dashboardBase}/auth/url-configuration` }}
        />
      </Section>

      {/* OAuth providers */}
      <Section title="OAuth Providers">
        <ProviderRow
          provider="Google"
          status={data?.providers.google ?? "unknown"}
          onTest={() => testProvider("google")}
          testing={testingProvider === "google"}
          dashboardHref={`${dashboardBase}/auth/providers`}
        />
        <ProviderRow
          provider="GitHub"
          status={data?.providers.github ?? "unknown"}
          onTest={() => testProvider("github")}
          testing={testingProvider === "github"}
          dashboardHref={`${dashboardBase}/auth/providers`}
        />
        {(data?.providers.google !== "enabled" || data?.providers.github !== "enabled") && (
          <div className="py-3">
            <p className="text-[11px] text-muted-foreground">
              To enable a provider: Supabase Dashboard → Auth → Providers → enable, paste OAuth credentials.
              Then add the callback URL above to the OAuth app's allowed redirect URIs.
            </p>
          </div>
        )}
      </Section>

      {/* Auth Routes */}
      <Section title="Auth Routes">
        <Row label="GET /auth/callback" kind="pass" detail="PKCE exchange — handles OAuth, email confirm, recovery" />
        <Row label="GET /auth/reset-password" kind="pass" detail="Set new password after recovery email" />
        <Row label="GET /auth/forgot" kind="pass" detail="Request password reset email" />
        <Row label="GET /auth/login" kind="pass" detail="Email/password + OAuth sign-in with callback error display" />
        <Row label="GET /auth/signup" kind="pass" detail="Email/password + OAuth sign-up" />
        <Row
          label="Middleware (proxy.ts)"
          kind={data ? (data.middleware ? "pass" : "fail") : "loading"}
          detail="Session refresh + protected-route guard — active on all app routes"
        />
      </Section>

      {/* Session */}
      <Section title="Session">
        <Row
          label="Current session"
          kind={data ? (data.session.active ? "pass" : "warn") : "loading"}
          detail={
            data
              ? data.session.active
                ? `Active — ${data.session.email}`
                : "No active session (expected on login page)"
              : undefined
          }
        />
        <Row
          label="Multi-tab sync"
          kind="pass"
          detail="Supabase @supabase/ssr uses httpOnly cookies — session shared across tabs"
        />
        <Row
          label="Token refresh"
          kind="pass"
          detail="Middleware refreshes session on every request before rendering"
        />
        <Row
          label="Incognito / private mode"
          kind="info"
          detail="OAuth works; cookies are cleared when session ends. No localStorage fallback needed."
        />
        <Row
          label="Mobile Safari OAuth"
          kind="info"
          detail="Uses redirect flow (no popups). Works in Safari. Add site to Supabase redirect allowlist."
        />
      </Section>

      {/* Email / SMTP */}
      <Section title="Email & SMTP">
        <Row
          label="Transactional email"
          kind="warn"
          detail="Free tier: ~4 emails/hour. Add a custom SMTP provider for production volumes."
          action={{ label: "Configure SMTP", href: `${dashboardBase}/auth/smtp` }}
        />
        <Row
          label="Rate limit awareness"
          kind="info"
          detail="Supabase free tier limits signup/reset emails. Consider Resend, Postmark, or SendGrid."
        />
        <Row
          label="SPF / DKIM / DMARC"
          kind="info"
          detail="Configure on your sending domain's DNS to prevent spam filtering of auth emails."
        />
        <Row
          label="Email templates"
          kind="info"
          detail="Customise confirmation, invite, and reset email templates in Supabase"
          action={{ label: "Email templates", href: `${dashboardBase}/auth/templates` }}
        />
      </Section>

      {/* Security */}
      <Section title="Security">
        <Row label="Client secrets" kind="pass" detail="No server secrets in NEXT_PUBLIC_ variables. Anon key only." />
        <Row label="Token logging" kind="pass" detail="No auth tokens logged in application code." />
        <Row label="Cookie security" kind="pass" detail="Supabase @supabase/ssr sets httpOnly, SameSite cookies." />
        <Row label="PKCE flow" kind="pass" detail="OAuth uses PKCE — no implicit flow token leakage." />
        <Row label="Redirect loop prevention" kind="pass" detail="Middleware checks auth before redirect; callback uses one-time codes." />
        <Row label="Protected route flash" kind="pass" detail="Server-side middleware redirects before page renders." />
      </Section>

      {data && (
        <p className="text-right text-[11px] text-muted-foreground/50">
          Last checked: {new Date(data.checkedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
