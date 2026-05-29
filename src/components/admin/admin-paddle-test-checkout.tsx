"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import type { BillablePlanId } from "@/lib/billing/billable-plans";

const TEST_PRESETS: { plan: BillablePlanId; interval: "monthly" | "annual"; label: string }[] = [
  { plan: "starter", interval: "monthly", label: "Starter monthly" },
  { plan: "pro", interval: "annual", label: "Pro annual" },
  { plan: "infinity_i", interval: "monthly", label: "Infinity I monthly" },
  { plan: "infinity_iv", interval: "monthly", label: "Infinity IV monthly" },
];

export function AdminPaddleTestCheckout() {
  const [plan, setPlan] = React.useState<BillablePlanId>("starter");
  const [interval, setInterval] = React.useState<"monthly" | "annual">("monthly");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<Record<string, unknown> | null>(null);

  async function startCheckout() {
    setBusy(true);
    setPreview(null);
    try {
      const res = await fetch("/api/billing/paddle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan,
          interval,
          confirmed: true,
          testMode: true,
          source: "admin_test_checkout",
        }),
      });
      const json = (await res.json()) as Record<string, unknown> & { url?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Checkout failed");
      setPreview(json);
      if (json.url) window.location.href = String(json.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px]">
        <p className="flex items-center gap-2 font-semibold text-amber-900">
          <AlertTriangle className="size-4" />
          Live mode charges real money
        </p>
        <p className="mt-1 text-muted-foreground">
          Owner-only checkout against production Paddle. Complete payment only when you intend to test a real charge.
          Entitlements apply only after a verified webhook with your user ID in custom_data.
        </p>
      </div>

      <section className="rounded-xl border border-border p-4 space-y-4">
        <h2 className="text-[14px] font-semibold">Test presets</h2>
        <div className="flex flex-wrap gap-2">
          {TEST_PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPlan(p.plan);
                setInterval(p.interval);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12px]">
            <span className="text-muted-foreground">Plan slug</span>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[13px]"
              value={plan}
              onChange={(e) => setPlan(e.target.value as BillablePlanId)}
            >
              {[
                "starter",
                "pro",
                "infinity_i",
                "infinity_ii",
                "infinity_iii",
                "infinity_iv",
                "infinity_v",
                "infinity_vi",
                "infinity_vii",
              ].map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[12px]">
            <span className="text-muted-foreground">Interval</span>
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[13px]"
              value={interval}
              onChange={(e) => setInterval(e.target.value as "monthly" | "annual")}
            >
              <option value="monthly">monthly</option>
              <option value="annual">annual</option>
            </select>
          </label>
        </div>

        <Button type="button" disabled={busy} onClick={() => void startCheckout()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Open live Paddle checkout
        </Button>
      </section>

      {preview ? (
        <section className="rounded-xl border border-border bg-muted/20 p-4">
          <h2 className="text-[14px] font-semibold">Checkout preview</h2>
          <pre className="mt-2 max-h-64 overflow-auto text-[11px]">{JSON.stringify(preview, null, 2)}</pre>
        </section>
      ) : null}

      <p className="text-[12px] text-muted-foreground">
        <Link href="/admin/billing/paddle" className="text-accent hover:underline">
          ← Back to Paddle readiness
        </Link>
        {" · "}
        <Link href="/settings/billing?paddle=success" className="text-accent hover:underline">
          Billing after checkout
          <ExternalLink className="ml-0.5 inline size-3" />
        </Link>
      </p>
    </div>
  );
}
