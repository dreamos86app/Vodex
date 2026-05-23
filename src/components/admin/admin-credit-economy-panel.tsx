"use client";

import * as React from "react";
import { Coins, TrendingUp, PiggyBank, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type EconomyRow = {
  totalUserCreditsCharged?: number;
  totalRevenueUsd?: number;
  totalInternalCostCredits?: number;
  avgRevenueMultiplier?: number;
  avgGrossMargin?: number;
  reservedCredits?: number;
  refundedCredits?: number;
  providerSpendUsd?: number;
  cacheHitRate?: number;
  estimatedTokensSaved?: number;
  byOperation?: Record<string, number>;
  events?: Array<{
    operationType?: string;
    revenueCredits?: number;
    revenueUsd?: number;
    providerCostUsd?: number;
    grossMargin?: number;
    revenueMultiplier?: number;
    status?: string;
  }>;
  failedCharges?: Array<{
    operationId?: string;
    userEmail?: string;
    model?: string;
    mode?: string;
    creditsConsumed?: number;
    providerCostUsd?: number;
    status?: string;
    error?: string;
    at?: string;
  }>;
  totalRequests?: number;
  failedChargeCount?: number;
};

export function AdminCreditEconomyPanel() {
  const [data, setData] = React.useState<EconomyRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [range, setRange] = React.useState("7d");
  const [operationType, setOperationType] = React.useState("");
  const [lowMarginOnly, setLowMarginOnly] = React.useState(false);
  const [failedOnly, setFailedOnly] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ range });
    if (operationType) qs.set("operationType", operationType);
    if (lowMarginOnly) qs.set("lowMarginOnly", "1");
    if (failedOnly) qs.set("failedOnly", "1");
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/credit-economy?${qs}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, operationType, lowMarginOnly, failedOnly]);

  const marginPct = data?.avgGrossMargin != null ? Math.round(data.avgGrossMargin * 100) : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Coins className="size-4 text-accent" />
        <h3 className="text-[14px] font-semibold text-foreground">Credit economy v2</h3>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="ml-auto rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
        >
          <option value="24h">24h</option>
          <option value="7d">7d</option>
          <option value="30d">30d</option>
        </select>
        <select
          value={operationType}
          onChange={(e) => setOperationType(e.target.value)}
          className="rounded-lg border border-border bg-background px-2 py-1 text-[11px]"
        >
          <option value="">All operations</option>
          <option value="polish">polish</option>
          <option value="edit">edit</option>
          <option value="build">build</option>
          <option value="full_build">full_build</option>
          <option value="blueprint">blueprint</option>
        </select>
        <label className="flex items-center gap-1 text-[11px]">
          <input type="checkbox" checked={lowMarginOnly} onChange={(e) => setLowMarginOnly(e.target.checked)} />
          Low margin
        </label>
        <label className="flex items-center gap-1 text-[11px]">
          <input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} />
          Failed only
        </label>
      </div>
      {loading ? (
        <p className="text-[12px] text-muted-foreground">Loading economy metrics…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={TrendingUp} label="Revenue (USD)" value={data?.totalRevenueUsd != null ? `$${data.totalRevenueUsd}` : "—"} />
            <StatCard icon={PiggyBank} label="Provider spend" value={data?.providerSpendUsd != null ? `$${data.providerSpendUsd}` : "—"} />
            <StatCard icon={Activity} label="Avg multiplier" value={data?.avgRevenueMultiplier != null ? `${data.avgRevenueMultiplier.toFixed(2)}×` : "—"} />
            <StatCard icon={Coins} label="Gross margin" value={marginPct != null ? `${marginPct}%` : "—"} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Requests {data?.totalRequests ?? 0} · Failed charges {data?.failedChargeCount ?? 0} · Reserved{" "}
            {data?.reservedCredits ?? 0} · Refunded {data?.refundedCredits ?? 0} · Cache hit{" "}
            {data?.cacheHitRate != null ? `${Math.round(data.cacheHitRate * 100)}%` : "—"}
          </p>
          {data?.failedCharges && data.failedCharges.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-[11px] font-semibold text-destructive">Failed charge diagnostics</p>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="p-1">Op ID</th>
                      <th className="p-1">User</th>
                      <th className="p-1">Model</th>
                      <th className="p-1">Mode</th>
                      <th className="p-1">Credits</th>
                      <th className="p-1">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.failedCharges.map((f, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="p-1 font-mono">{f.operationId?.slice(0, 8) ?? "—"}</td>
                        <td className="p-1">{f.userEmail ?? "—"}</td>
                        <td className="p-1">{f.model}</td>
                        <td className="p-1">{f.mode}</td>
                        <td className="p-1">{f.creditsConsumed ?? 0}</td>
                        <td className="p-1 text-destructive">{f.error?.slice(0, 48) ?? f.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {data?.events && data.events.length > 0 ? (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-2">Op</th>
                    <th className="p-2">Rev</th>
                    <th className="p-2">Cost</th>
                    <th className="p-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="p-2">{e.operationType}</td>
                      <td className="p-2">{e.revenueCredits}c</td>
                      <td className="p-2">${e.providerCostUsd?.toFixed(3)}</td>
                      <td className="p-2">{e.grossMargin != null ? `${Math.round(e.grossMargin * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border/70 bg-background/50 p-3")}>
      <Icon className="mb-1 size-3.5 text-muted-foreground" />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-[14px] font-semibold text-foreground">{value}</p>
    </div>
  );
}
