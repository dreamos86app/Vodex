"use client";

import * as React from "react";
import { RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  markClientFetchError,
  markClientFetchSuccess,
  shouldThrottleClientFetch,
} from "@/lib/network/client-fetch-backoff";

type ProviderRow = {
  provider: string;
  configured: boolean;
  status: string;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorClass: string | null;
  balanceApiAvailable: boolean;
  requests24h: number;
  cost24hUsd: number;
  cost7dUsd: number;
  cost30dUsd: number;
  failures24h: number;
  warnings: string[];
};

type Payload = {
  checkedAt: string;
  providers: ProviderRow[];
  note?: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Gemini",
  xai: "xAI",
};

const STATUS_COLOR: Record<string, string> = {
  available: "text-emerald-600",
  degraded: "text-amber-600",
  quota_exhausted: "text-destructive",
  auth_error: "text-destructive",
  rate_limited: "text-amber-600",
  disabled: "text-muted-foreground",
  coming_soon: "text-muted-foreground",
};

export function AdminProviderHealthPanel() {
  const [data, setData] = React.useState<Payload | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const key = "admin_provider_health";
    if (shouldThrottleClientFetch(key)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/provider-health", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        setData((await res.json()) as Payload);
        markClientFetchSuccess(key);
      } else {
        markClientFetchError(key);
      }
    } catch {
      markClientFetchError(key);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-[var(--radius-xl)] bg-surface ring-1 ring-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          AI provider health (owner only)
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg p-1.5 text-muted-foreground ring-1 ring-border hover:bg-background"
          title="Refresh"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </button>
      </div>
      <div className="divide-y divide-border">
        {loading && !data ? (
          <p className="px-4 py-6 text-center text-[11px] text-muted-foreground">Loading…</p>
        ) : null}
        {(data?.providers ?? []).map((p) => (
          <div key={p.provider} className="px-4 py-3">
            <div className="flex items-center gap-2">
              {p.status === "available" ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="size-4 text-amber-500" />
              )}
              <span className="text-[12.5px] font-medium text-foreground">
                {PROVIDER_LABELS[p.provider] ?? p.provider}
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono uppercase",
                  STATUS_COLOR[p.status] ?? "text-muted-foreground",
                )}
              >
                {p.status.replace(/_/g, " ")}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {p.configured ? "key configured" : "no key"}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10.5px] text-muted-foreground sm:grid-cols-4">
              <span>24h req: {p.requests24h}</span>
              <span>24h fail: {p.failures24h}</span>
              <span>24h $: {p.cost24hUsd}</span>
              <span>7d $: {p.cost7dUsd}</span>
            </div>
            {p.lastErrorClass ? (
              <p className="mt-1 text-[10px] text-destructive/90">
                Last error class: {p.lastErrorClass}
                {p.lastErrorAt ? ` · ${new Date(p.lastErrorAt).toLocaleString()}` : ""}
              </p>
            ) : null}
            {p.warnings.length > 0 ? (
              <ul className="mt-1 list-inside list-disc text-[10px] text-amber-700 dark:text-amber-400">
                {p.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
      {data?.note ? (
        <p className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">{data.note}</p>
      ) : null}
      {data?.checkedAt ? (
        <p className="px-4 pb-2 text-right text-[10px] text-muted-foreground/60">
          {new Date(data.checkedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}
