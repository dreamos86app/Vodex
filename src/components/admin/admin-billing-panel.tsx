"use client";

import * as React from "react";
import { AlertCircle, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SubRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  plan_id: string;
  status: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  pending_downgrade_plan: string | null;
  stripe_subscription_id_masked: string | null;
  stripe_customer_id_masked: string | null;
};

export function AdminBillingPanel() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [subscriptions, setSubscriptions] = React.useState<SubRow[]>([]);
  const [stripeMeta, setStripeMeta] = React.useState<{
    configured: boolean;
    missingEnv: string[];
    webhookPath: string;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/admin/subscriptions")
      .then(async (res) => {
        const json = (await res.json()) as {
          subscriptions?: SubRow[];
          stripe?: { configured: boolean; missingEnv: string[]; webhookPath: string };
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.error ?? "Failed to load");
          setSubscriptions([]);
        } else {
          setSubscriptions(json.subscriptions ?? []);
          setStripeMeta(json.stripe ?? null);
          setError(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Network error");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stripeMeta && !stripeMeta.configured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px]">
          <p className="font-medium text-foreground">Stripe setup required</p>
          <p className="mt-1 text-muted-foreground">Missing env vars (names only):</p>
          <ul className="mt-2 list-inside list-disc font-mono text-[11px]">
            {stripeMeta.missingEnv.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Webhook endpoint: <code className="text-foreground">{stripeMeta.webhookPath}</code>
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-surface ring-1 ring-border">
        <table className="w-full min-w-[800px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Period end</th>
              <th className="px-4 py-2.5">Cancel?</th>
              <th className="px-4 py-2.5">Pending downgrade</th>
              <th className="px-4 py-2.5">Stripe sub</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No subscription rows yet. Paid users appear here after Stripe webhooks run.
                </td>
              </tr>
            ) : (
              subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-border/50">
                  <td className="px-4 py-3">{s.user_email ?? s.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 capitalize">{s.plan_id}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        s.status === "active"
                          ? "bg-positive/15 text-positive"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(s.current_period_end).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{s.cancel_at_period_end ? "Yes" : "—"}</td>
                  <td className="px-4 py-3 capitalize">{s.pending_downgrade_plan ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">
                    {s.stripe_subscription_id_masked ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CreditCard className="size-3.5" />
        Stripe IDs are truncated. Full IDs exist only in Stripe Dashboard and secure server logs.
      </p>
    </div>
  );
}
