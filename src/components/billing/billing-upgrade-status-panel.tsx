"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_DISPLAY } from "@/lib/billing/plans";
import { refreshCredits } from "@/lib/stores/credits-store";

type AttemptDiagnosis = {
  code: string;
  message: string;
  success: boolean;
  live?: {
    plan_id: string;
    build_credits: number;
    action_credits: number;
    period_end: string | null;
  };
};

type AttemptTrace = {
  plan_before?: string;
  plan_after?: string | null;
  build_before?: number;
  build_after?: number | null;
  action_before?: number;
  action_after?: number | null;
  period_end_before?: string | null;
  period_end_after?: string | null;
  webhook_received?: boolean;
  entitlement_apply_completed?: boolean;
};

type StatusPayload = {
  upgradeComplete?: boolean;
  attemptDiagnosis?: AttemptDiagnosis | null;
  attemptTrace?: AttemptTrace | null;
  buildCredits?: { remaining: number; cap: number };
  actionCredits?: { remaining: number; cap: number };
};

type Props = {
  attemptId: string | null;
  onComplete?: () => void;
};

export function BillingUpgradeStatusPanel({ attemptId, onComplete }: Props) {
  const [status, setStatus] = React.useState<StatusPayload | null>(null);
  const [polling, setPolling] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);

  React.useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    let tries = 0;
    setPolling(true);

    const poll = async () => {
      tries += 1;
      setAttempts(tries);
      const res = await fetch(`/api/billing/status?attemptId=${encodeURIComponent(attemptId)}`, {
        credentials: "include",
      });
      const json = (await res.json()) as StatusPayload;
      if (cancelled) return;
      setStatus(json);

      if (json.upgradeComplete) {
        await refreshCredits({ force: true, reason: "plan-change" });
        setPolling(false);
        onComplete?.();
        return;
      }

      if (tries >= 40) {
        setPolling(false);
        return;
      }
      window.setTimeout(() => void poll(), 2500);
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [attemptId, onComplete]);

  if (!attemptId) return null;

  const diagnosis = status?.attemptDiagnosis;
  const trace = status?.attemptTrace;
  const success = diagnosis?.success === true;

  if (!diagnosis && polling) {
    return (
      <div className="rounded-lg border border-border bg-card/60 p-4 flex items-center gap-3 text-sm">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        Verifying upgrade with server…
      </div>
    );
  }

  if (success) {
    const planName =
      PLAN_DISPLAY[(diagnosis?.live?.plan_id ?? "free") as keyof typeof PLAN_DISPLAY]?.name ??
      diagnosis?.live?.plan_id;
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 font-medium">
          <CheckCircle2 className="h-5 w-5" />
          Plan upgraded successfully
        </div>
        <p className="text-sm text-muted-foreground">{diagnosis?.message}</p>
        <ul className="text-sm space-y-1">
          <li>Plan: {planName}</li>
          <li>
            Build credits: {diagnosis?.live?.build_credits ?? status?.buildCredits?.remaining} /{" "}
            {status?.buildCredits?.cap ?? "—"}
          </li>
          <li>
            Action credits: {diagnosis?.live?.action_credits ?? status?.actionCredits?.remaining} /{" "}
            {status?.actionCredits?.cap ?? "—"}
          </li>
          {diagnosis?.live?.period_end ? (
            <li>Next renewal: {new Date(diagnosis.live.period_end).toLocaleString()}</li>
          ) : null}
        </ul>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-center gap-2 text-amber-300 font-medium">
        {polling ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
        {polling ? "Waiting for billing confirmation…" : "Upgrade not complete yet"}
      </div>
      <p className="text-sm font-medium">{diagnosis?.message ?? "Checking server state…"}</p>
      {diagnosis?.code ? (
        <p className="text-xs font-mono text-muted-foreground">Code: {diagnosis.code}</p>
      ) : null}
      {trace ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Attempt trace</summary>
          <pre className="mt-2 overflow-auto rounded bg-black/30 p-2">
            {JSON.stringify(trace, null, 2)}
          </pre>
        </details>
      ) : null}
      {!polling ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setAttempts(0);
            setPolling(true);
            void fetch(`/api/billing/status?attemptId=${encodeURIComponent(attemptId)}`, {
              credentials: "include",
            })
              .then((r) => r.json())
              .then((j) => setStatus(j as StatusPayload));
          }}
        >
          Retry check
        </Button>
      ) : null}
    </div>
  );
}
