"use client";

import * as React from "react";
import { CreditCard, Smartphone, Shield, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { parseJsonResponse } from "@/lib/api/safe-json";
import { MobileBillingWizard } from "@/components/payments/mobile-billing-wizard";
import { ContextualHelp } from "@/components/help/contextual-help";
import { IntegrationIconWell } from "@/components/brand/integration-icons";
import {
  PAYMENT_PROVIDER_CAPABILITIES,
  connectionModeLabel,
} from "@/lib/integrations/provider-capabilities";

type ProviderCard = {
  provider: string;
  label: string;
  tagline: string;
  is_mobile: boolean;
  can_connect: boolean;
  status: string;
  mode: string;
  product_count: number;
  last_error: string | null;
  webhook_url?: string | null;
};

const PAYMENT_ICON: Record<string, string> = {
  stripe: "stripe",
  paddle: "paddle",
  paypal: "paypal",
  lemon_squeezy: "lemonsqueezy",
  revenuecat: "revenuecat",
};

function apiErrorMessage(data: { error?: string | { message?: string } } | null): string {
  if (!data?.error) return "Request failed";
  if (typeof data.error === "string") return data.error;
  return data.error.message ?? "Request failed";
}

export function ProjectPaymentsPanel({
  projectId,
  planId,
  published = true,
}: {
  projectId: string;
  planId: string | null;
  published?: boolean;
}) {
  const [loading, setLoading] = React.useState(true);
  const [providers, setProviders] = React.useState<ProviderCard[]>([]);
  const [notice, setNotice] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [mode, setMode] = React.useState<"test" | "live" | "sandbox">("test");
  const [apiKey, setApiKey] = React.useState("");
  const [publishableKey, setPublishableKey] = React.useState("");
  const [webhookSecret, setWebhookSecret] = React.useState("");
  const [storeId, setStoreId] = React.useState("");
  const [testPriceId, setTestPriceId] = React.useState("");
  const [setupWarning, setSetupWarning] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [readiness, setReadiness] = React.useState<
    Record<string, { mode: string; checkoutStatus: string; message: string; canTestPayment: boolean }>
  >({});

  const load = React.useCallback(async () => {
    if (!published) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/payments/providers`, {
        credentials: "include",
      });
      const { data, error: parseErr } = await parseJsonResponse<{
        ok?: boolean;
        error?: string;
        providers?: ProviderCard[];
        responsibility_notice?: string;
        setup_warning?: string;
        warning?: string;
      }>(res);
      if (parseErr || !data) throw new Error(parseErr ?? "Failed to load payments");
      if (!res.ok && data.ok === false) throw new Error(apiErrorMessage(data));
      setProviders((data.providers ?? []) as ProviderCard[]);
      setNotice(data.responsibility_notice ?? "");
      setSetupWarning(data.setup_warning ?? data.warning ?? null);
      const readyRes = await fetch(`/api/projects/${projectId}/payments/readiness`, {
        credentials: "include",
      });
      if (readyRes.ok) {
        const readyJson = (await readyRes.json()) as {
          providers?: Array<{
            provider: string;
            mode: string;
            checkoutStatus: string;
            message: string;
            canTestPayment: boolean;
          }>;
        };
        const map: typeof readiness = {};
        for (const r of readyJson.providers ?? []) {
          map[r.provider] = {
            mode: r.mode,
            checkoutStatus: r.checkoutStatus,
            message: r.message,
            canTestPayment: r.canTestPayment,
          };
        }
        setReadiness(map);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load payments");
    } finally {
      setLoading(false);
    }
  }, [projectId, published]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!published) {
    return null;
  }

  async function saveProvider() {
    if (!selected) return;
    setSaving(true);
    try {
      const secrets: Record<string, string> = {};
      if (apiKey.trim()) secrets.api_key = apiKey.trim();
      if (selected === "stripe") {
        if (apiKey.trim()) secrets.secret_key = apiKey.trim();
        if (publishableKey.trim()) secrets.publishable_key = publishableKey.trim();
      }
      if (webhookSecret.trim()) secrets.webhook_secret = webhookSecret.trim();
      if (selected === "lemon_squeezy" && storeId.trim()) secrets.store_id = storeId.trim();

      const res = await fetch(
        `/api/projects/${projectId}/payments/providers/${selected}/save`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ mode, secrets, publicConfig: {} }),
        },
      );
      const { data, error: parseErr } = await parseJsonResponse(res);
      if (parseErr || !data?.ok) throw new Error(parseErr ?? apiErrorMessage(data));
      toast.success("Payment settings saved");
      setApiKey("");
      setPublishableKey("");
      setWebhookSecret("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function verifyProvider(provider: string) {
    const res = await fetch(
      `/api/projects/${projectId}/payments/providers/${provider}/verify`,
      { method: "POST", credentials: "include" },
    );
    const { data, error: parseErr } = await parseJsonResponse(res);
    if (parseErr || !data?.ok) {
      toast.error(parseErr ?? apiErrorMessage(data));
    } else {
      toast.success((data as { message?: string }).message ?? "Verified");
    }
    await load();
  }

  async function runTestCheckout(provider: string) {
    if (!testPriceId.trim()) {
      toast.error("Enter a price or variant ID first");
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/payments/test-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ provider, priceId: testPriceId.trim() }),
    });
    const { data, error: parseErr } = await parseJsonResponse<{ ok?: boolean; checkoutUrl?: string; error?: { message?: string } }>(res);
    if (parseErr || !data?.ok) {
      toast.error(parseErr ?? apiErrorMessage(data));
      return;
    }
    if (data.checkoutUrl) window.open(data.checkoutUrl, "_blank", "noopener");
  }

  const connected = providers.filter(
    (p) =>
      p.status === "verified" ||
      p.status === "connected" ||
      p.status === "webhook_verified" ||
      p.status === "webhook_missing",
  );

  return (
    <div className="space-y-6 p-4">
      <ContextualHelp guideHref="/help/payments/stripe" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">Payments & Billing</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Connect your own payment provider so your app can charge your customers. Vodex is not
          your merchant.
        </p>
      </div>

      {setupWarning ? (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
          {setupWarning}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((p) => (
              <button
                key={p.provider}
                type="button"
                onClick={() => setSelected(p.provider)}
                className={cn(
                  "cursor-pointer rounded-xl border p-4 text-left transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                  selected === p.provider
                    ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                    : "border-border bg-background hover:border-accent/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <IntegrationIconWell
                      provider={PAYMENT_ICON[p.provider] ?? p.provider}
                      size="md"
                      className="shrink-0"
                    />
                    <div>
                      <p className="text-[14px] font-semibold">{p.label}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {PAYMENT_PROVIDER_CAPABILITIES[p.provider]?.bestFor ?? p.tagline}
                      </p>
                    </div>
                  </div>
                  {p.is_mobile ? (
                    <Smartphone className="size-4 text-muted-foreground" />
                  ) : (
                    <CreditCard className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {PAYMENT_PROVIDER_CAPABILITIES[p.provider] ? (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {connectionModeLabel(PAYMENT_PROVIDER_CAPABILITIES[p.provider].connectionMode)}
                    </span>
                  ) : null}
                  <StatusPill status={p.status} />
                  {readiness[p.provider] ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {readiness[p.provider].mode}
                    </span>
                  ) : null}
                </div>
                {readiness[p.provider]?.message ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">{readiness[p.provider].message}</p>
                ) : null}
                {p.provider === "revenuecat" && (
                  <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                    Mobile app subscriptions — Google Play and Apple process in-app purchases.
                    RevenueCat helps verify purchases and sync entitlements.
                  </p>
                )}
              </button>
            ))}
          </div>

          {selected && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-[13px] font-medium">Connect {selected}</p>
              {!providers.find((x) => x.provider === selected)?.can_connect ? (
                <p className="text-[12px] text-amber-700 dark:text-amber-300">
                  Upgrade to a paid Vodex plan to connect live payment providers.
                </p>
              ) : (
                <>
                  <div className="flex gap-2">
                    {(["test", "sandbox", "live"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize",
                          mode === m ? "bg-foreground text-background" : "bg-background text-muted-foreground ring-1 ring-border",
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <input
                    type="password"
                    placeholder={selected === "stripe" ? "Secret key (sk_…)" : "API key"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                  />
                  {selected === "stripe" && (
                    <input
                      type="text"
                      placeholder="Publishable key (pk_…)"
                      value={publishableKey}
                      onChange={(e) => setPublishableKey(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                    />
                  )}
                  {selected === "lemon_squeezy" && (
                    <input
                      type="text"
                      placeholder="Store ID"
                      value={storeId}
                      onChange={(e) => setStoreId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                    />
                  )}
                  <input
                    type="password"
                    placeholder="Webhook secret (optional)"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={saving} onClick={() => void saveProvider()}>
                      {saving ? "Saving…" : "Save connection"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void verifyProvider(selected)}
                    >
                      Verify config
                    </Button>
                  </div>
                  <input
                    type="text"
                    placeholder="Price / variant ID for test checkout"
                    value={testPriceId}
                    onChange={(e) => setTestPriceId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px]"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => void runTestCheckout(selected)}>
                    Run test checkout
                  </Button>
                  <button
                    type="button"
                    className="text-[11px] text-accent hover:underline"
                    onClick={() => setShowAdvanced((v) => !v)}
                  >
                    {showAdvanced ? "Hide" : "Show"} advanced setup
                  </button>
                  {showAdvanced && (
                    <p className="text-[10px] font-mono text-muted-foreground break-all">
                      Webhook URL:{" "}
                      {providers.find((x) => x.provider === selected)?.webhook_url ?? "—"}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {selected === "revenuecat" && <MobileBillingWizard projectId={projectId} />}

          {connected.length > 0 && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <p className="text-[12px] font-medium text-emerald-800 dark:text-emerald-200">
                {connected.length} provider(s) connected · {connected.reduce((s, p) => s + p.product_count, 0)} products mapped
              </p>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2 rounded-xl border border-border/60 bg-muted/15 p-3 text-[11px] text-muted-foreground">
        <Shield className="size-4 shrink-0" />
        <p>{notice}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok =
    status === "verified" ||
    status === "connected" ||
    status === "webhook_verified" ||
    status === "webhook_missing";
  const err = status === "error";
  return (
    <span
      className={cn(
        "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        ok && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        err && "bg-destructive/10 text-destructive",
        !ok && !err && "bg-muted text-muted-foreground",
      )}
    >
      {ok ? <CheckCircle2 className="size-3" /> : err ? <AlertCircle className="size-3" /> : null}
      {status.replace(/_/g, " ")}
    </span>
  );
}
