"use client";

import * as React from "react";
import Link from "next/link";
import {
  Loader2,
  Lock,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { IntegrationIconWell } from "@/components/brand/integration-icons";
import {
  INTEGRATION_CATEGORIES,
  INTEGRATIONS_CATALOG,
  type IntegrationCatalogItem,
} from "@/lib/integrations/integrations-catalog";
import { canUseIntegrations } from "@/lib/billing/plan-features";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SupabaseConnectModal } from "@/components/integrations/supabase-connect-modal";
import { IntegrationConnectModal } from "@/components/integrations/integration-connect-modal";
import { ContextualHelp } from "@/components/help/contextual-help";

type RowStatus = { provider: string; status: string; display_name: string | null };

function IntegrationCard({
  item,
  status,
  locked,
  busy,
  onConnect,
}: {
  item: IntegrationCatalogItem;
  status: string;
  locked: boolean;
  busy: boolean;
  onConnect: () => void;
}) {
  const connected = status === "connected";

  return (
    <article
      className={cn(
        "integration-catalog-card relative flex flex-col overflow-hidden rounded-2xl bg-surface p-4 ring-1 ring-border transition",
        !locked && "hover:ring-accent/35 hover:shadow-md",
        locked && "opacity-95",
      )}
      data-testid={`integration-card-${item.id}`}
    >
      {locked ? (
        <div className="pointer-events-none absolute inset-0 z-[1] bg-background/40 backdrop-blur-[1px]" />
      ) : null}
      <div className="relative z-[2] flex items-start gap-3">
        <IntegrationIconWell provider={item.id} className="size-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-semibold text-foreground">{item.label}</h3>
            {connected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3" /> Connected
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Not connected
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.description}</p>
        </div>
      </div>
      <div className="relative z-[2] mt-4 flex flex-wrap items-center gap-2">
        {locked ? (
          <Link
            href="/pricing"
            className="vodex-upgrade-cta inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-bold"
          >
            <Lock className="size-3.5" />
            Upgrade to connect
          </Link>
        ) : (
          <button
            type="button"
            disabled={busy || connected}
            onClick={onConnect}
            className="flex-1 rounded-xl bg-accent px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            data-testid={`integration-connect-${item.id}`}
          >
            {busy ? (
              <Loader2 className="mx-auto size-4 animate-spin" />
            ) : connected ? (
              "Connected"
            ) : (
              "Connect"
            )}
          </button>
        )}
        <a
          href={item.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-[12px] font-medium text-muted-foreground ring-1 ring-border hover:text-foreground"
        >
          Docs
          <ExternalLink className="size-3" />
        </a>
      </div>
    </article>
  );
}

export function IntegrationsCatalogPanel({
  projectId,
  planId,
  onInsertChatPrompt,
}: {
  projectId: string;
  planId?: string | null;
  onInsertChatPrompt?: (prompt: string) => void;
}) {
  const locked = !canUseIntegrations(planId);
  const [rows, setRows] = React.useState<RowStatus[]>([]);
  const [userLinks, setUserLinks] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [supabaseProjects, setSupabaseProjects] = React.useState<
    Array<{ ref: string; name: string }>
  >([]);
  const [showSupabasePicker, setShowSupabasePicker] = React.useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = React.useState(false);
  const [connectModalProvider, setConnectModalProvider] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [intRes, userRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/integrations`, { credentials: "include" }),
        fetch("/api/integrations/user/connections", { credentials: "include" }),
      ]);
      const intJson = (await intRes.json()) as { integrations?: RowStatus[] };
      setRows(intJson.integrations ?? []);
      const userJson = (await userRes.json()) as {
        connections?: Array<{ provider: string; connected: boolean }>;
      };
      const map: Record<string, boolean> = {};
      for (const c of userJson.connections ?? []) {
        map[c.provider] = c.connected;
      }
      setUserLinks(map);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function statusFor(id: string) {
    return rows.find((r) => r.provider === id)?.status ?? "disconnected";
  }

  async function connectGitHub() {
    setBusyId("github");
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/github/quick-connect`, {
        method: "POST",
        credentials: "include",
      });
      const json = (await res.json()) as { needsOAuth?: boolean; oauthUrl?: string; error?: string };
      if (res.status === 409 && json.needsOAuth && json.oauthUrl) {
        window.location.href = json.oauthUrl;
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "GitHub connect failed");
      toast.success("GitHub connected");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "GitHub connect failed");
    } finally {
      setBusyId(null);
    }
  }

  function linkSupabaseAccount() {
    setShowSupabaseModal(true);
  }

  async function openSupabasePicker() {
    setBusyId("supabase");
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/supabase/projects`, {
        credentials: "include",
      });
      const json = (await res.json()) as {
        linked?: boolean;
        projects?: Array<{ ref: string; name: string }>;
        error?: string;
      };
      if (!json.linked) {
        await linkSupabaseAccount();
        return;
      }
      setSupabaseProjects(json.projects ?? []);
      setShowSupabasePicker(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load projects");
    } finally {
      setBusyId(null);
    }
  }

  async function connectSupabaseProject(projectRef: string) {
    setBusyId("supabase");
    try {
      const res = await fetch(`/api/projects/${projectId}/integrations/supabase/quick-connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ projectRef }),
      });
      const json = (await res.json()) as { needsLink?: boolean; error?: string };
      if (res.status === 409 && json.needsLink) {
        await linkSupabaseAccount();
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "Connect failed");
      toast.success("Supabase connected for this app");
      setShowSupabasePicker(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Supabase connect failed");
    } finally {
      setBusyId(null);
    }
  }

  function connectItem(item: IntegrationCatalogItem) {
    if (locked) return;
    if (item.connectMode === "oauth_github") {
      void connectGitHub();
      return;
    }
    if (item.connectMode === "oauth_supabase") {
      void openSupabasePicker();
      return;
    }
    if (item.connectMode === "chat_prompt" && item.chatPrompt && onInsertChatPrompt) {
      onInsertChatPrompt(item.chatPrompt);
      toast.info("Prompt added to chat — review and press Submit");
      return;
    }
    if (item.connectMode === "secrets_form") {
      setConnectModalProvider(item.id);
    }
  }

  return (
    <div className="space-y-6" data-testid="integrations-catalog-panel">
      <ContextualHelp guideHref="/help/integrations/supabase" />
      <div className="rounded-xl bg-sky-500/5 px-4 py-3 ring-1 ring-sky-500/15">
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          Connect services for <strong className="text-foreground">this app only</strong>. Secrets are
          encrypted server-side and never shown again.{" "}
          {userLinks.github || userLinks.supabase ? (
            <span className="text-foreground">
              Your Vodex account is linked — GitHub and Supabase can connect in one click.
            </span>
          ) : (
            <span>Link GitHub or Supabase once to reuse on every app.</span>
          )}
        </p>
        {!locked ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = `/api/integrations/github/user/oauth/start?returnTo=${encodeURIComponent(`/apps/${projectId}/builder?tab=dashboard&section=integrations`)}`;
              }}
              className="rounded-lg bg-surface px-3 py-1.5 text-[11px] font-semibold ring-1 ring-border"
              data-testid="link-github-account"
            >
              {userLinks.github ? "GitHub linked ✓" : "Link GitHub account"}
            </button>
            <button
              type="button"
              onClick={() => void linkSupabaseAccount()}
              className="rounded-lg bg-surface px-3 py-1.5 text-[11px] font-semibold ring-1 ring-border"
              data-testid="link-supabase-account"
            >
              {userLinks.supabase ? "Supabase linked ✓" : "Link Supabase account"}
            </button>
          </div>
        ) : null}
      </div>

      {locked ? (
        <div
          className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-accent/30 bg-gradient-to-br from-accent/5 to-violet-500/5 px-6 py-10 text-center"
          data-testid="integrations-pro-lock"
        >
          <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/25">
            <Lock className="size-6 text-accent" />
          </div>
          <p className="text-[15px] font-semibold text-foreground">Integrations are a Pro feature</p>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            View what you can connect below. Upgrade to link GitHub, Supabase, and more with one click.
          </p>
          <Link href="/pricing" className="vodex-upgrade-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold">
            <Sparkles className="size-4" />
            Upgrade to Pro
          </Link>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-6 animate-spin text-accent" />
        </div>
      ) : (
        INTEGRATION_CATEGORIES.map((cat) => {
          const items = INTEGRATIONS_CATALOG.filter((i) => i.category === cat.id);
          return (
            <section key={cat.id}>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.label}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    status={statusFor(item.id)}
                    locked={locked}
                    busy={busyId === item.id || busyId === `${item.id}-link`}
                    onConnect={() => connectItem(item)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      <SupabaseConnectModal
        open={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        onLinked={(projects) => {
          setUserLinks((m) => ({ ...m, supabase: true }));
          if (projects.length) {
            setSupabaseProjects(projects);
            setShowSupabasePicker(true);
          }
        }}
      />

      {showSupabasePicker ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-background p-5 shadow-2xl ring-1 ring-border">
            <h3 className="text-[16px] font-bold text-foreground">Select Supabase project</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Keys are saved encrypted for this app only.
            </p>
            <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {supabaseProjects.map((p) => (
                <li key={p.ref}>
                  <button
                    type="button"
                    onClick={() => void connectSupabaseProject(p.ref)}
                    className="w-full rounded-xl bg-surface px-3 py-2.5 text-left text-[13px] font-medium ring-1 ring-border hover:ring-accent/40"
                  >
                    {p.name}
                    <span className="ml-2 text-[11px] text-muted-foreground">{p.ref}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowSupabasePicker(false)}
              className="mt-4 w-full rounded-xl py-2 text-[13px] font-medium text-muted-foreground ring-1 ring-border"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {connectModalProvider ? (
        <IntegrationConnectModal
          open
          projectId={projectId}
          providerId={connectModalProvider}
          onClose={() => setConnectModalProvider(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
